import { tool } from 'ai';
import z from 'zod';

/**
 * client-side tool that is automatically executed on the client.
 */
export const insertImageTool = tool({
  description: 'Insert an image into the canvas.',
  inputSchema: z.object({
    imageUrl: z.string().describe('The URL of the image to insert into the canvas'),
    width: z.number().describe('The width of the image to insert into the canvas'),
    height: z.number().describe('The height of the image to insert into the canvas'),
  }),
});