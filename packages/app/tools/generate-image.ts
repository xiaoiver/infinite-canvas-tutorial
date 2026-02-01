import { put } from '@vercel/blob';
import { FilePart, generateText, tool } from 'ai';
import z, { nanoid } from 'zod';

/**
 * When building a chatbot, you may want to allow the user to generate an image.
 * This can be done by creating a tool that generates an image using the generateImage function from the AI SDK.
 * @see https://ai-sdk.dev/cookbook/next/generate-image-with-chat-prompt
 * 
 * Image optimization:
 * @see https://vercel.com/docs/image-optimization
 * 
 * Edit image:
 * @see https://ai-sdk.dev/cookbook/node/call-tools-with-image-prompt
 */

export const generateImageTool = tool({
  description: 'Generate or edit images based on a text prompt and optionally reference images. The generated or edited images will be automatically displayed in the tool output component. Do NOT include image URLs in your response message - the images are already shown in the tool interface.',
  inputSchema: z.object({
    prompt: z.string().describe('The prompt to generate the image from'),
    // referenceImages: z.array(z.string()).describe('Reference images to use for the generation').optional(),
  }),
  execute: async ({ prompt }, { messages }) => {
    const lastMessage = messages[messages.length - 1];
    const imageDataURLs = (lastMessage.content as (FilePart)[]).filter((part) => part.type === 'file' && part.mediaType.startsWith('image/')).map((part) => part.data);

    const result = await generateText({
      model: 'google/gemini-2.5-flash-image',
      prompt: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            ...(imageDataURLs?.map(url => ({
              type: 'image' as const,
              image: new URL(url.toString()),
            })) || []),
          ]
        }
      ],
      providerOptions: {
        google: {
          quality: 'low'
        }
      }
    });

    const imageUrls: string[] = [];
    // Save generated images
    for (const file of result.files) {
      if (file.mediaType.startsWith('image/')) {
        const base64 = file.base64;

        // 1. 去掉 base64 前缀（例如 "data:image/png;base64,"）
        const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");

        // 2. 转换为 Buffer
        const fileBuffer = Buffer.from(base64Data, 'base64');

        // Upload with Vercel Blob
        const fileName = `${nanoid()}`;
        const blob = await put(fileName, fileBuffer, {
          access: 'public',
          addRandomSuffix: true,
        });

        imageUrls.push(blob.url);
      }
    }

    return { images: imageUrls };

    // return {
    //   images: [
    //     'https://cdn.gooo.ai/web-images/807beef85b24ebe408f250d0b898eb7ff2d686177206372991decbffb40681d7',
    //     // 'https://cdn.gooo.ai/gen-images/f8d6b9c6a423ea78ae00ce89b9148c7441e29934cc172c3557c36df81e00259b.png'
    //   ]
    // };
  },
});