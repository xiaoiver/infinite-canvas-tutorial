import { tool } from 'ai';
import z from 'zod';

/**
 * client-side tool that is automatically executed on the client.
 */
export const insertImageTool = tool({
  description: `Insert an image into the canvas. 
If the user message contains an image file, use the image file's data field as the image URL.`,
  inputSchema: z.object({
    image: z.string().describe('The URL of the image to insert into the canvas').optional(),
    width: z.number().describe('The width of the image to insert into the canvas').optional(),
    height: z.number().describe('The height of the image to insert into the canvas').optional(),
  }),
  outputSchema: z.object({
    nodeId: z.string().describe('The node id of the image node inserted into the canvas').optional(),
  }),
});
