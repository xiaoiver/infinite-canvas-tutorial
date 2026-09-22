import { Canvas, System, WorkerClient } from '@infinite-canvas-tutorial/ecs';
// @ts-expect-error - Vite resolves worker URLs.
import workerUrl from './worker.js?worker&url';
import {
  canvasToFloat32Array,
  image2Canvas,
  imgTensorToCanvas,
  maskCanvasToFloat32Array,
  resizeCanvas,
} from './utils';

const imageSize = { w: 512, h: 512 };

export class LaMaSystem extends System {
  private readonly canvases = this.query((q) => q.added.with(Canvas));
  private cleanups = new Set<() => void>();

  execute() {
    this.canvases.added.forEach((canvas) => {
      const { api } = canvas.read(Canvas);
      const client = new WorkerClient(
        () => new Worker(workerUrl, { type: 'module' }),
      );
      const unregister = api.capabilities.register(
        'removeByMask',
        'lama',
        (input) =>
          client.run(async () => {
            const image = await image2Canvas(input.image_url);
            const { float32Array: imgArray, shape: imgArrayShape } =
              canvasToFloat32Array(resizeCanvas(image, imageSize));
            const { float32Array: maskArray, shape: maskArrayShape } =
              maskCanvasToFloat32Array(resizeCanvas(input.mask, imageSize));
            const tensor = await client.request('runRemove', {
              imgArray,
              imgArrayShape,
              maskArray,
              maskArrayShape,
            });
            return {
              canvas: resizeCanvas(imgTensorToCanvas(tensor), {
                w: image.width,
                h: image.height,
              }),
            };
          }),
      );
      const dispose = api.onDestroy(() => {
        unregister();
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
