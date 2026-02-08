import { createClient } from '@/lib/supabase/server';
import { tool } from 'ai';
import z from 'zod';
import { getModelForCapability } from '@/lib/models/get-model';
import { fal } from '@fal-ai/client';

/**
 * Use qwen-image-layered to split the image into multiple layers
 * @see https://ai-sdk.dev/providers/ai-sdk-providers/fal
 * @see https://fal.ai/models/fal-ai/qwen-image-layered/playground
 */
export const decomposeImageTool = tool({
  description: 'Decompose the image into multiple layers.',
  inputSchema: z.object({
    image: z.string().describe('The URL of the image to split into layers'),
  }),
  execute: async ({ image }) => {
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
    const result = await fal.subscribe("fal-ai/qwen-image-layered", {
      input: {
        image_url: image,
      },
    });

    return {
      images: result.data.images.map((image: { url: string }) => image.url),
    };
  },
});