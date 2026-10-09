import { createApp } from 'vue';
import D2 from '../../../packages/site/docs/components/D2.vue';
import type { API } from '../../../packages/ecs/src';
import { settleECSFrames } from './ecs-frames';

let api: API | undefined;
const app = createApp(D2);
app.mount('#demo');
document.querySelector('ic-spectrum-canvas')!.addEventListener(
  'ic-ready',
  (event) => {
    api = (event as CustomEvent<API>).detail;
  },
  { once: true },
);

const probe = {
  ready: () => !!api?.getNodeById('y'),
  nodes: () => api!.getNodes(),
  async arrange() {
    await api!.edit(() => {
      api!.setAppState({ cameraX: 0, cameraY: 0, cameraZoom: 1 });
      api!.updateNodes([
        { ...api!.getNodeById('x')!, x: 360, y: 20, width: 60, height: 60 },
        { ...api!.getNodeById('y')!, x: 160, y: 180, width: 60, height: 60 },
      ]);
    });
    await settleECSFrames(api!);
  },
  dragPoint(id: string) {
    const node = api!.getNodeById(id)!;
    return api!.viewport2Client(
      api!.canvas2Viewport({
        x: node.x! + node.width! / 4,
        y: node.y! + node.height! / 4,
      }),
    );
  },
  settle: () => settleECSFrames(api!),
  unmount: () => app.unmount(),
};
declare global {
  interface Window {
    d2Docs: typeof probe;
  }
}
window.d2Docs = probe;
