import { Canvas, System, imageToCanvas } from '@infinite-canvas-tutorial/ecs';
import { createFalClient } from '@fal-ai/client';

export class FalAISystem extends System {
  protected client = createFalClient();
  private readonly canvases = this.query((q) => q.added.with(Canvas));

  private cleanups = new Set<() => void>();

  execute() {
    this.canvases.added.forEach((canvas) => {
      const { api } = canvas.read(Canvas);
      const fal = this.client;

      const unregister: (() => void)[] = [];

      unregister.push(
        api.capabilities.register('upload', 'fal-ai', async (file: File) => {
          return await fal.storage.upload(file);
        }),
      );

      unregister.push(
        api.capabilities.register(
          'createOrEditImage',
          'fal-ai',
          async (
            isEdit: boolean,
            prompt: string,
            image_urls: string[],
          ): Promise<{ images: { url: string }[]; description: string }> => {
            const result = await fal.subscribe(
              isEdit
                ? 'fal-ai/gemini-25-flash-image/edit'
                : 'fal-ai/gemini-25-flash-image',
              {
                input: {
                  prompt,
                  image_urls,
                },
              },
            );
            return result.data;
          },
        ),
      );

      unregister.push(
        api.capabilities.register('segmentImage', 'fal-ai', async (input) => {
          const result = await fal.subscribe('fal-ai/sam-3/image', {
            input,
          });

          // Convert Image to HTMLCanvasElement
          const canvas = await imageToCanvas(result.data.image.url);
          return { image: { canvas } };
        }),
      );

      // Do nothing here
      unregister.push(
        api.capabilities.register('encodeImage', 'fal-ai', async () => {}),
      );

      unregister.push(
        api.capabilities.register('decomposeImage', 'fal-ai', async (input) => {
          const { image_url, num_layers } = input;
          const result = await fal.subscribe('fal-ai/qwen-image-layered', {
            input: {
              image_url,
              num_layers,
            },
          });
          return result.data;
        }),
      );

      unregister.push(
        api.capabilities.register('upscaleImage', 'fal-ai', async (input) => {
          const { image_url, scale_factor } = input;
          // fal-ai/drct-super-resolution
          const result = await fal.subscribe('fal-ai/seedvr/upscale/image', {
            input: {
              image_url,
              upscale_factor: scale_factor || 2,
            },
          });
          return result.data.image;
        }),
      );
      const dispose = api.onDestroy(() => {
        unregister.forEach((remove) => remove());
        this.cleanups.delete(dispose);
      });
      this.cleanups.add(dispose);
    });
  }

  finalize() {
    this.cleanups.forEach((dispose) => dispose());
  }
}
