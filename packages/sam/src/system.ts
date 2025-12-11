import { Canvas, System } from '@infinite-canvas-tutorial/ecs';
import {
  canvasToFloat32Array,
  image2Canvas,
  resizeCanvas,
  sliceTensorMask,
} from './utils';

// resize+pad all images to 1024x1024
const imageSize = { w: 1024, h: 1024 };
// const maskSize = { w: 256, h: 256 };

export class SAMSystem extends System {
  private readonly canvases = this.query((q) => q.added.with(Canvas));
  private worker: Worker | null = null;

  execute() {
    this.canvases.added.forEach((canvas) => {
      const { api } = canvas.read(Canvas);

      api.encodeImage = async (image: string) => {
        api.setAppState({ loading: true, loadingMessage: 'Encoding image...' });
        const originalOnMessage = this.worker.onmessage;

        const canvas = await image2Canvas(image);

        return new Promise((resolve, reject) => {
          this.worker.onmessage = (event) => {
            const { type, data } = event.data;
            if (type == 'encodeImageDone') {
              api.setAppState({ loading: false, loadingMessage: '' });

              this.worker.onmessage = originalOnMessage;
              resolve(data);
            }
            originalOnMessage?.call(this.worker, event);
          };

          this.worker.postMessage({
            type: 'encodeImage',
            data: canvasToFloat32Array(resizeCanvas(canvas, imageSize)),
          });
        });
      };

      api.segmentImage = async (input) => {
        const { point_prompts } = input;
        if (point_prompts.length === 0) {
          return;
        }

        const selectedNode = api.getNodeById(
          api.getAppState().layersSelected[0],
        );

        const { x, y, label } = point_prompts[0];
        // input image will be resized to 1024x1024 -> normalize mouse pos to 1024x1024
        const point = {
          x: (x / selectedNode.width) * imageSize.w,
          y: (y / selectedNode.width) * imageSize.h,
          label,
        };

        return new Promise((resolve, reject) => {
          const originalOnMessage = this.worker.onmessage;
          this.worker.onmessage = (event) => {
            const { type, data } = event.data;
            if (type == 'decodeMaskResult') {
              // SAM2 returns 3 mask along with scores -> select best one
              const maskTensors = data.masks;
              const maskScores = data.iou_predictions.cpuData;
              const bestMaskIdx = maskScores.indexOf(Math.max(...maskScores));
              const maskCanvas = sliceTensorMask(maskTensors, bestMaskIdx);

              const maskCanvasResized = resizeCanvas(maskCanvas, {
                w: imageSize.w,
                h: imageSize.h,
              });

              this.worker.onmessage = originalOnMessage;
              resolve({ image: maskCanvasResized });
            }
            originalOnMessage?.call(this.worker, event);
          };
          this.worker.postMessage({
            type: 'decodeMask',
            data: {
              points: [point],
              maskArray: null,
              maskShape: null,
            },
          });
        });
      };

      if (!this.worker) {
        // @ts-ignore - import.meta is only available in ES modules, but this code will run in ES module environments
        const workerUrl = new URL('./sam-worker.js', import.meta.url);
        this.worker = new Worker(workerUrl, {
          type: 'module',
        });

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
          } else if (
            type == 'downloadInProgress' ||
            type == 'loadingInProgress'
          ) {
          } else if (type == 'encodeImageDone') {
            api.setAppState({ loading: false, loadingMessage: '' });
          }
        };

        this.worker.onerror = (error) => {
          console.error('Worker error:', error);
          api.setAppState({ loading: false, loadingMessage: '' });
        };

        api.setAppState({
          loading: true,
          loadingMessage: 'Loading SAM models...',
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
