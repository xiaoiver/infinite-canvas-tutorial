import { Canvas, System } from '@infinite-canvas-tutorial/ecs';
// @ts-expect-error - import.meta is only available in ES modules, but this code will run in ES module environments
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
  private worker: Worker | null = null;

  execute() {
    this.canvases.added.forEach((canvas) => {
      const { api } = canvas.read(Canvas);

      api.removeByMask = async (input: {
        image_url: string;
        mask: HTMLCanvasElement;
      }) => {
        const { image_url, mask } = input;
        api.setAppState({
          loading: true,
          loadingMessage: 'Removing by mask...',
        });
        const originalOnMessage = this.worker.onmessage;

        const image = await image2Canvas(image_url);

        return new Promise((resolve, reject) => {
          this.worker.onmessage = (event) => {
            const { type, data } = event.data;
            if (type == 'removeDone') {
              const imgTensor = data as Float32Array;
              let imgCanvas = imgTensorToCanvas(imgTensor);

              api.setAppState({ loading: false, loadingMessage: '' });

              this.worker.onmessage = originalOnMessage;
              resolve({
                canvas: resizeCanvas(imgCanvas, {
                  w: image.width,
                  h: image.height,
                }),
              });
            }
            originalOnMessage?.call(this.worker, event);
          };

          const { float32Array: imgArray, shape: imgArrayShape } =
            canvasToFloat32Array(resizeCanvas(image, imageSize));
          const { float32Array: maskArray, shape: maskArrayShape } =
            maskCanvasToFloat32Array(resizeCanvas(mask, imageSize));

          this.worker.postMessage({
            type: 'runRemove',
            data: {
              imgArray: imgArray,
              imgArrayShape: imgArrayShape,
              maskArray: maskArray,
              maskArrayShape: maskArrayShape,
            },
          });
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
          console.error('Failed to create SAM worker:', error);
        }

        this.worker.onmessage = (event) => {
          const { type, data } = event.data;

          if (type == 'pong') {
            const { success } = data;
            if (success) {
              api.setAppState({ loading: false, loadingMessage: '' });
            } else {
              api.setAppState({ loading: false, loadingMessage: '' });
              console.error('Failed to load SAM models');
            }
          }
        };

        this.worker.onerror = (error) => {
          console.error('Worker error:', error);
          api.setAppState({ loading: false, loadingMessage: '' });
        };

        api.setAppState({
          loading: true,
          loadingMessage: 'Loading LaMa models...',
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
