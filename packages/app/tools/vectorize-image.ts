import { createClient } from '@/lib/supabase/server';
import { FilePart, tool } from 'ai';
import z from 'zod';

export const runtime = 'nodejs';

// Enum values from @neplex/vectorizer (const enums cannot be accessed with isolatedModules)
const ColorMode = { Color: 0, Binary: 1 } as const;
const Hierarchical = { Stacked: 0, Cutout: 1 } as const;
const PathSimplifyMode = { None: 0, Polygon: 1, Spline: 2 } as const;

export const vectorizeImageTool = tool({
  description: 'Convert the raster image to vector graphics.',
  inputSchema: z.object({
    image: z.string().describe('The URL of the image to convert to vector graphics'),
  }),
  execute: async ({ image }, { messages }) => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'User not found' };
    }

    const lastMessage = messages[messages.length - 1];
    const imageDataURLs = (lastMessage.content as FilePart[]).filter((part) => part.type === 'file' && part.filename !== 'mask' && part.mediaType.startsWith('image/')).map((part) => part.data);

    const { vectorize } = await import('@neplex/vectorizer');

    const src = await fetch(new URL(imageDataURLs[0].toString())).then((res) => res.arrayBuffer());
    const svg = await vectorize(Buffer.from(src), {
      colorMode: ColorMode.Color,
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

    return {
      svg
    };
  },
});