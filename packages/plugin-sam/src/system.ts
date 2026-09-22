import { Canvas, System, WorkerClient } from '@infinite-canvas-tutorial/ecs';
import {
  canvasToFloat32Array,
  image2Canvas,
  resizeCanvas,
  sliceTensorMask,
} from './utils';
// @ts-expect-error - Vite resolves worker URLs.
import workerUrl from './worker.js?worker&url';

const imageSize = { w: 1024, h: 1024 };

export class SAMSystem extends System {
  private readonly canvases = this.query((q) => q.added.with(Canvas));
  private cleanups = new Set<() => void>();

  execute() {
    this.canvases.added.forEach((canvas) => {
      const { api } = canvas.read(Canvas);
      const client = new WorkerClient(
        () => new Worker(workerUrl, { type: 'module' }),
      );
      let encodedURL: string;
      const encode = async (url: string) => {
        if (encodedURL === url) return;
        const image = await image2Canvas(url);
        await client.request(
          'encodeImage',
          canvasToFloat32Array(resizeCanvas(image, imageSize)),
        );
        encodedURL = url;
      };
      const unregister = [
        api.capabilities.register('encodeImage', 'sam', (url) =>
          client.run(() => encode(url)),
        ),
        api.capabilities.register('segmentImage', 'sam', (input) =>
          client.run(async () => {
            if (!input.point_prompts?.length)
              throw new Error('SAM requires a point prompt');
            const selected = api.getNodeById(
              api.getAppState().layersSelected[0],
            );
            const size = selected && api.getAbsoluteTransformAndSize(selected);
            if (!size?.width || !size?.height)
              throw new Error('Select an image before segmenting');
            const { x, y, label } = input.point_prompts[0];
            // Keep encoding and decoding atomic even when callers segment different images.
            await encode(input.image_url);
            const data = await client.request<any>('decodeMask', {
              points: [
                {
                  x: (x / size.width) * imageSize.w,
                  y: (y / size.height) * imageSize.h,
                  label,
                },
              ],
              maskArray: null,
              maskShape: null,
            });
            const scores = data.iou_predictions.cpuData;
            const best = scores.indexOf(Math.max(...scores));
            return {
              image: {
                canvas: resizeCanvas(
                  sliceTensorMask(data.masks, best),
                  imageSize,
                ),
              },
            };
          }),
        ),
      ];
      const dispose = api.onDestroy(() => {
        unregister.forEach((remove) => remove());
        client.dispose();
        this.cleanups.delete(dispose);
      });
      this.cleanups.add(dispose);
    });
  }

  finalize() {
    this.cleanups.forEach((dispose) => dispose());
  }
}
