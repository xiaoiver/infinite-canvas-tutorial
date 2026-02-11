import { createClient } from '@/lib/supabase/server';
import { tool } from 'ai';
import z from 'zod';
import { getModelForCapability } from '@/lib/models/get-model';
import { fal } from '@fal-ai/client';
import { getImagesFromLastMessage } from '@/lib/file';

/**
 * Use qwen-image-layered to split the image into multiple layers
 * @see https://ai-sdk.dev/providers/ai-sdk-providers/fal
 * @see https://fal.ai/models/fal-ai/qwen-image-layered/playground
 */
export const decomposeImageTool = tool({
  description: 'Decompose the image into multiple layers.',
  inputSchema: z.object({
    numLayers: z.number().describe('The number of layers to decompose the image into. Default to 4.').optional(),
    // num_inference_steps: z.number().describe('The number of inference steps to use for the decomposition. Default to 28.').optional(),
  }),
  execute: async ({ numLayers }, { messages }) => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'User not found' };
    }

    const modelInfo = await getModelForCapability(user.id, 'image-layered');
    if (!modelInfo) {
      return { error: 'No image-layered model configured' };
    }

    const { apiKey } = modelInfo;
    fal.config({
      credentials: apiKey
    });

    const imageDataURLs = getImagesFromLastMessage(messages);
    if (imageDataURLs.length === 0) {
      return { error: 'No image found in the last user message' };
    }

    try {
      const result = await fal.subscribe("fal-ai/qwen-image-layered", {
        input: {
          image_url: imageDataURLs[0],
          num_layers: numLayers,
        },
      });
      return {
        type: 'content',
        value: [
          ...result.data.images.map((image: { url: string }) => ({
            type: 'image-url',
            url: image.url,
          })),
        ],
      };
    } catch (error) {
      console.error('Error decomposing image:', error);
      return { error: 'Failed to decompose image' };
    }
  },
});