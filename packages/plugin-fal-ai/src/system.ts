import { Canvas, System } from '@infinite-canvas-tutorial/ecs';
import { fal } from '@fal-ai/client';

export class FalAISystem extends System {
  private readonly canvases = this.query((q) => q.added.with(Canvas));

  execute() {
    this.canvases.added.forEach((canvas) => {
      const { api } = canvas.read(Canvas);

      api.upload = async (file: File) => {
        return await fal.storage.upload(file);
      };

      api.createOrEditImage = async (
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
      };

      api.segmentImage = async (input) => {
        const { image_url } = input;
        const result = await fal.subscribe('fal-ai/sam-3/image', {
          input: {
            image_url,
          },
        });

        // Convert Image to HTMLCanvasElement
        const image = result.data.image as unknown as HTMLImageElement;
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(image, 0, 0);
        return { image: canvas };
      };

      // Do nothing here
      api.encodeImage = async (image: string) => {};

      api.decomposeImage = async (input) => {
        const { image_url, num_layers } = input;
        const result = await fal.subscribe('fal-ai/qwen-image-layered', {
          input: {
            image_url,
            num_layers,
          },
        });
        return result.data;
      };
    });
  }
}
