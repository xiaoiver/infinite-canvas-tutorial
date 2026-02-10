import { tool } from 'ai';
import z from 'zod';

/**
 * client-side tool that is automatically executed on the client.
 */
export const drawElementTool = tool({
  description: 'Draw an element on the canvas.',
  inputSchema: z.object({
    type: z.enum(['rect', 'ellipse', 'line', 'polyline', 'path', 'rough-rect', 'rough-ellipse', 'rough-line', 'rough-polyline', 'rough-path']).describe('The type of the element to draw on the canvas'),
    x: z.number().describe('The x coordinate.').optional(),
    y: z.number().describe('The y coordinate.').optional(),
    width: z.number().describe('The width.').optional(),
    height: z.number().describe('The height.').optional(),
    d: z.string().describe('The d attribute of path or rough-path, e.g. "M 0 0 L 100 100 L 200 0 Z".').optional(),
    points: z.string().describe('The points of polyline or rough-polyline, e.g. "0,0 100,100 200,0".').optional(),
    x1: z.number().describe('The x1 coordinate of line or rough-line.').optional(),
    y1: z.number().describe('The y1 coordinate of line or rough-line.').optional(),
    x2: z.number().describe('The x2 coordinate of line or rough-line.').optional(),
    y2: z.number().describe('The y2 coordinate of line or rough-line.').optional(),
    fill: z.string().describe('The fill.').optional(),
    stroke: z.string().describe('The stroke.').optional(),
    strokeWidth: z.number().describe('The stroke width.').optional(),
    strokeOpacity: z.number().describe('The stroke opacity.').optional(),
    strokeAlignment: z.enum(['inner', 'outer']).describe('The stroke alignment.').optional(),
    strokeLineCap: z.enum(['butt', 'round', 'square']).describe('The stroke line cap.').optional(),
    strokeLineJoin: z.enum(['miter', 'round', 'bevel']).describe('The stroke line join.').optional(),
    strokeMiterLimit: z.number().describe('The stroke miter limit.').optional(),
    strokeDasharray: z.string().describe('The stroke dasharray.').optional(),
    strokeDashoffset: z.number().describe('The stroke dashoffset.').optional(),
    strokeLinecap: z.enum(['butt', 'round', 'square']).describe('The stroke linecap.').optional(),
    strokeLinejoin: z.enum(['miter', 'round', 'bevel']).describe('The stroke linejoin.').optional(),
  }),
  outputSchema: z.object({
    nodeId: z.string().describe('The node id of the element drawn on the canvas').optional(),
  }),
});