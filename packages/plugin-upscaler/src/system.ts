import { Canvas, System, WorkerClient } from '@infinite-canvas-tutorial/ecs';
import * as tf from '@tensorflow/tfjs';
// @ts-expect-error - Vite resolves worker URLs.
import workerUrl from './worker.js?worker&url';

export class UpscalerSystem extends System {
  private readonly canvases = this.query((q) => q.added.with(Canvas));
  private cleanups = new Set<() => void>();

  execute() {
    this.canvases.added.forEach((canvas) => {
      const { api } = canvas.read(Canvas);
      const client = new WorkerClient(
        () => new Worker(workerUrl, { type: 'module' }),
      );
      const unregister = api.capabilities.register(
        'upscaleImage',
        'upscaler',
        (input) =>
          client.run(async () => {
            if (input.scale_factor != null && input.scale_factor !== 4) {
              throw new Error(
                'The local Upscaler model supports scale_factor 4',
              );
            }
            const image = await new Promise<HTMLImageElement>(
              (resolve, reject) => {
                const image = new Image();
                image.crossOrigin = 'anonymous';
                image.onload = () => resolve(image);
                image.onerror = () =>
                  reject(new Error('Failed to load the image for upscaling'));
                image.src = input.image_url;
              },
            );
            const pixels = tf.browser.fromPixels(image);
            let result: [number[], [number, number, number]];
            try {
              result = await client.request('upscaleImage', [
                await pixels.data(),
                pixels.shape,
              ]);
            } finally {
              pixels.dispose();
            }
            const [data, shape] = result;
            const tensor = tf.tidy(
              () => tf.tensor3d(data, shape).div(255) as tf.Tensor3D,
            );
            try {
              const output = document.createElement('canvas');
              await tf.browser.toPixels(tensor, output);
              return { canvas: output };
            } finally {
              tensor.dispose();
            }
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
