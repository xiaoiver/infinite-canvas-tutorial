import { Canvas, System } from '@infinite-canvas-tutorial/ecs';
// @ts-expect-error - import.meta is only available in ES modules, but this code will run in ES module environments
import workerUrl from './worker.js?worker&url';

export class YogaSystem extends System {
  private readonly canvases = this.query((q) => q.added.with(Canvas));
  private worker: Worker | null = null;

  execute() {
    this.canvases.added.forEach((canvas) => {
      const { api } = canvas.read(Canvas);

      if (!this.worker) {
        try {
          // @ts-ignore - import.meta is only available in ES modules, but this code will run in ES module environments
          // const workerUrl = new URL('./sam-worker.js', import.meta.url);
          this.worker = new Worker(workerUrl, {
            type: 'module',
          });
        } catch (error) {
          console.error('Failed to create Yoga worker:', error);
        }

        this.worker.onmessage = (event) => {
          const { type, data } = event.data;

          if (type == 'pong') {
            const { success } = data;
            if (success) {
              api.setAppState({ loading: false, loadingMessage: '' });

              // Test layout
              // const data = {
              //   id: 'root',
              //   width: 100,
              //   height: 100,
              //   alignItems: 'center',
              //   justifyContent: 'center',
              //   children: [
              //     {
              //       id: 'child',
              //       width: '50%',
              //       height: '50%'
              //     }
              //   ]
              // };
              // this.worker.postMessage({ type: 'process', data });

            } else {
              api.setAppState({ loading: false, loadingMessage: '' });
              console.error('Failed to load Yoga');
            }
          } else if (type == 'processDone') {
            console.log(data);
          }
        };

        this.worker.onerror = (error) => {
          console.error('Worker error:', error);
          api.setAppState({ loading: false, loadingMessage: '' });
        };

        api.setAppState({
          loading: true,
          loadingMessage: 'Loading Yoga...',
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