import { tool } from 'ai';
import z from 'zod';

export const splitLayersTool = tool({
  description: 'Split the image into multiple layers.',
  inputSchema: z.object({
    imageUrl: z.string().describe('The URL of the image to split into layers'),
  }),
  execute: async ({ imageUrl }) => {
    // TODO: use qwen-image-layered to split the image into multiple layers
    return {
      layers: []
    };
  },
});