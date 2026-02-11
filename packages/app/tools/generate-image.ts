import { FilePart, generateText, generateImage, tool, ModelMessage } from 'ai';
import z from 'zod';
import { createImageModel, createLanguageModel, getModelForCapability, ModelInfo } from '@/lib/models/get-model';
import { createClient } from '@/lib/supabase/server';
import { uploadImage } from '@/lib/blob';
import { getImagesFromLastMessage, getMaskFromLastMessage } from '@/lib/file';

/**
 * When building a chatbot, you may want to allow the user to generate an image.
 * This can be done by creating a tool that generates an image using the generateImage function from the AI SDK.
 * @see https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-image
 * @see https://ai-sdk.dev/cookbook/next/generate-image-with-chat-prompt
 * @see https://vercel.com/changelog/nano-banana-pro-gemini-3-pro-image-now-available-in-the-ai-gateway
 * 
 * Image optimization:
 * @see https://vercel.com/docs/image-optimization
 * 
 * Edit image:
 * @see https://ai-sdk.dev/cookbook/node/call-tools-with-image-prompt
 * @see https://ai.google.dev/gemini-api/docs/image-generation
 */

const QUALITY_IMAGE_SIZE_MAP: Record<'low' | 'standard' | 'high', string> = {
  low: '1K',
  standard: '2K',
  high: '4K',
};

function buildGoogleProviderOptions(
  model: string,
  options: {
    quality?: 'low' | 'standard' | 'high';
    size?: string; // 如 '1024x1024', '1024x768'
    aspectRatio?: string; // 如 '16:9', '1:1', '4:3'
  }
): Record<string, any> {
  return {
    responseModalities: ['TEXT', 'IMAGE'],
    imageConfig: {
      // Only Gemini 3 Pro supports image size
      // @see https://ai.google.dev/gemini-api/docs/image-generation
      imageSize: model.includes('3-pro') ? QUALITY_IMAGE_SIZE_MAP[options.quality ?? 'standard'] : undefined,
      aspectRatio: options.aspectRatio,
    }
  }
}

/**
 * 根据 provider 类型和通用参数生成对应的 providerOptions
 * 不同 provider 的参数格式不同，这里进行统一映射
 */
function buildProviderOptions(
  modelInfo: ModelInfo,
  options: {
    quality?: 'low' | 'standard' | 'high';
    size?: string; // 如 '1024x1024', '1024x768'
    aspectRatio?: string; // 如 '16:9', '1:1', '4:3'
  }
): Record<string, any> {
  const providerOptions: Record<string, any> = {};
  const { provider, model } = modelInfo;

  switch (provider) {
    case 'google':
      providerOptions.google = buildGoogleProviderOptions(model, options);
      break;

    case 'openai':
      if (options.size || options.quality) {
        providerOptions.openai = {};
        if (options.size) {
          providerOptions.openai.size = options.size;
        }
        if (options.quality) {
          providerOptions.openai.quality = options.quality === 'high' ? 'hd' : 'standard';
        }
      }
      break;

    case 'gateway':
      // @see https://vercel.com/docs/ai-gateway/capabilities/image-generation/ai-sdk#openai-models-with-image-generation-tool
      if (model.startsWith('google/')) {
        providerOptions.google = buildGoogleProviderOptions(model, options);
      }
      break;

    case 'fal':
      if (options.size || options.aspectRatio) {
        providerOptions.fal = {};
        if (options.size) {
          providerOptions.fal.size = options.size;
        }
        if (options.aspectRatio) {
          providerOptions.fal.aspectRatio = options.aspectRatio;
        }
      }
      break;

    default:
      console.warn(`Unknown provider: ${provider}, using default options`);
      break;
  }

  return providerOptions;
}

export const generateImageTool = tool({
  description: `Generate or edit images based on a text prompt and optionally mask areas.
The generated or edited images will be automatically displayed in the tool output component.
Do NOT include image URLs in your response message - the images are already shown in the tool interface.`,
  inputSchema: z.object({
    mode: z.enum(['generate', 'edit']).describe('Whether to generate a new image or edit an existing one'),
    operation: z.enum(['erase', 'inpaint', 'outpaint', 'replace']).optional(),
    instruction: z.string().describe(
      'The user instruction. Keep it concise and literal.'
    ),
    quality: z.enum(['low', 'standard', 'high']).optional().describe('Image quality: low (faster, lower quality), standard (balanced), or high (slower, higher quality). Default to standard.'),
    size: z.string().optional().describe('Image size in format "WIDTHxHEIGHT", e.g., "1024x1024", "1024x768". Supported sizes vary by provider.'),
    aspectRatio: z.string().optional().describe('Aspect ratio, e.g., "16:9", "1:1", "4:3". Some providers support this instead of size.'),
  }),
  execute: async ({ instruction, quality = 'standard', size, aspectRatio }, { messages }): Promise<{
    type: 'content',
    value: {
      type: 'image-url',
      url: string;
    }[];
  } | {
    error: string;
  }> => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'User not found' };
    }

    const modelInfo = await getModelForCapability(user.id, 'image');
    if (!modelInfo) {
      return { error: 'No image model configured' };
    }

    const imageDataURLs = getImagesFromLastMessage(messages);
    const maskDataURLs = getMaskFromLastMessage(messages);

    const imageUrls: string[] = [];
    const providerOptions = buildProviderOptions(modelInfo, {
      quality,
      size,
      aspectRatio,
    });

    try {

      // Note that this is a multi-modal model and therefore uses generateText for the actual image generation.
      if (modelInfo.model.includes('gemini')) {
        const languageModel = createLanguageModel(modelInfo);
        if (!languageModel) {
          return { error: 'Failed to create language model' };
        }

        const promptMessages = [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: instruction,
              },
              ...(imageDataURLs?.map(url => ({
                type: 'image' as const,
                image: new URL(url.toString()),
              })) || []),
              ...(maskDataURLs.length > 0 ? [{
                type: 'text' as const,
                text: 'Use the following mask area(s) to in-paint the image.',
              }] : []),
              ...(maskDataURLs?.map(url => ({
                type: 'image' as const,
                image: new URL(url.toString()),
              })) || [])
            ]
          }
        ] as ModelMessage[];

        // console.log('prompt', JSON.stringify(promptMessages));

        const result = await generateText({
          model: languageModel,
          prompt: promptMessages,
          providerOptions: Object.keys(providerOptions).length > 0 ? providerOptions : undefined,
        });

        // Save generated images
        for (const file of result.files) {
          if (file.mediaType.startsWith('image/')) {
            const url = await uploadImage(file);
            imageUrls.push(url);
          }
        }
      } else {
        const imageModel = createImageModel(modelInfo);
        if (!imageModel) {
          return { error: 'Failed to create image model' };
        }
        const { images } = await generateImage({
          model: imageModel,
          prompt: instruction,
          size: size as `${number}x${number}`,
          // recraft: "This model does not support aspect ratio. Use `size` instead."
          aspectRatio: modelInfo.model.includes('recraft') ? undefined : aspectRatio as `${number}:${number}`,
          providerOptions: Object.keys(providerOptions).length > 0 ? providerOptions : undefined,
        });

        for (const image of images) {
          const url = await uploadImage(image);
          imageUrls.push(url);
        }
      }

      return {
        type: 'content',
        value: [
          ...imageUrls.map(imageUrl => ({
            type: 'image-url' as const,
            url: imageUrl,
          })),
        ]
      };
    } catch (error) {
      console.error('Error generating image:', error);
      return { error: 'Failed to generate image' };
    }

    // return {
    //   images: [
    //     'https://cdn.gooo.ai/web-images/807beef85b24ebe408f250d0b898eb7ff2d686177206372991decbffb40681d7',
    //     // 'https://cdn.gooo.ai/gen-images/f8d6b9c6a423ea78ae00ce89b9148c7441e29934cc172c3557c36df81e00259b.png'
    //   ]
    // };
  },
});