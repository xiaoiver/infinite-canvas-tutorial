import { Canvas, System } from '@infinite-canvas-tutorial/ecs';
import { fal } from '@fal-ai/client';

// // FIXME: Dangerous !!!
// // use https://developers.cloudflare.com/workers/configuration/environment-variables/
// fal.config({
//   credentials:
//     '5e973660-e3f7-492f-ae94-fb9c499252aa:143cc831830ba6cd4fe9fdb01a8564d0',
// });

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
        return { image: result.data.image };
      };

      // Do nothing here
      api.encodeImage = async (image: string) => {};
    });
  }
}
