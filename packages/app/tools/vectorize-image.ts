import { uploadSVG } from '@/lib/blob';
import { getImagesFromLastMessage } from '@/lib/file';
import { createClient } from '@/lib/supabase/server';
import { tool } from 'ai';
import z from 'zod';

export const runtime = 'nodejs';

// Enum values from @neplex/vectorizer (const enums cannot be accessed with isolatedModules)
const ColorMode = { Color: 0, Binary: 1 } as const;
const Hierarchical = { Stacked: 0, Cutout: 1 } as const;
const PathSimplifyMode = { None: 0, Polygon: 1, Spline: 2 } as const;

export const vectorizeImageTool = tool({
  description: 'Convert the raster image to vector graphics.',
  inputSchema: z.object({
    colorMode: z.enum(['color', 'binary']).describe('The color mode to use for the vectorization. Default to color.'),
  }),
  execute: async ({ colorMode }, { messages }) => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'User not found' };
    }

    const imageDataURLs = getImagesFromLastMessage(messages);
    if (imageDataURLs.length === 0) {
      return { error: 'No image found in the last user message' };
    }

    const { vectorize } = await import('@neplex/vectorizer');

    try {
      const src = await fetch(new URL(imageDataURLs[0].toString())).then((res) => res.arrayBuffer());
      const svg = await vectorize(Buffer.from(src), {
        colorMode: colorMode === 'color' ? ColorMode.Color : ColorMode.Binary,
        colorPrecision: 6,
        filterSpeckle: 4,
        spliceThreshold: 45,
        cornerThreshold: 60,
        hierarchical: Hierarchical.Stacked,
        mode: PathSimplifyMode.Spline,
        layerDifference: 5,
        lengthThreshold: 5,
        maxIterations: 2,
        pathPrecision: 5,
      });

      // Upload SVG to vercel blob
      const svgUrl = await uploadSVG(svg);
      return {
        type: 'content',
        value: [
          {
            type: 'image-url',
            url: svgUrl,
          },
        ]
      };
    } catch (error) {
      console.error('Error vectorizing image:', error);
      return { error: 'Failed to vectorize image' };
    }
  },
});