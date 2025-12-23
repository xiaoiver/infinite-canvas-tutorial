import { Canvas, System } from '@infinite-canvas-tutorial/ecs';
import * as tf from '@tensorflow/tfjs';
// @ts-expect-error - import.meta is only available in ES modules, but this code will run in ES module environments
import workerUrl from './worker.js?worker&url';

export class UpscalerSystem extends System {
  private readonly canvases = this.query((q) => q.added.with(Canvas));
  private worker: Worker | null = null;

  execute() {
    this.canvases.added.forEach((canvas) => {
      const { api } = canvas.read(Canvas);

      api.upscaleImage = async (input: {
        image_url: string;
        scale_factor?: number;
      }) => {
        const { image_url, scale_factor } = input;

        return new Promise((resolve, reject) => {
          const image = new Image();
          image.src = image_url;
          image.crossOrigin = 'anonymous';
          image.onload = async () => {
            const pixels = tf.browser.fromPixels(image);
            await tf.nextFrame();
            const data = await pixels.data();
            this.worker.postMessage({
              type: 'upscaleImage',
              data: [data, pixels.shape],
            });
          };

          const originalOnMessage = this.worker.onmessage;
          this.worker.onmessage = async (e) => {
            const {
              type,
              data: [data, shape],
            } = e.data;
            if (type === 'upscaleImageDone') {
              const tensor = tf.tidy(() => tf.tensor(data, shape).div(255));
              const canvas = document.createElement('canvas');
              canvas.height = shape[0];
              canvas.width = shape[1];
              // @ts-ignore - tf.browser.toPixels is not typed correctly
              await tf.browser.toPixels(tensor, canvas);
              tensor.dispose();

              this.worker.onmessage = originalOnMessage;
              resolve({ canvas });
            }
            originalOnMessage?.call(this.worker, e);
          };

          this.worker.onerror = (error) => {
            reject(error);
          };
        });
      };

      if (!this.worker) {
        try {
          // @ts-ignore - import.meta is only available in ES modules, but this code will run in ES module environments
          // const workerUrl = new URL('./sam-worker.js', import.meta.url);
          this.worker = new Worker(workerUrl, {
            type: 'module',
          });
        } catch (error) {
          console.error('Failed to create Upscaler worker:', error);
        }

        this.worker.onmessage = (e) => {
          const { type } = e.data;
          if (type === 'pong') {
            api.setAppState({ loading: false, loadingMessage: '' });
          }
        };

        api.setAppState({
          loading: true,
          loadingMessage: 'Loading Upscaler model...',
        });
        this.worker.postMessage({ type: 'ping' });
      }
    });
  }

  finalize(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
