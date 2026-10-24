import { createApp } from 'vue';
import IsometricView from '../../../packages/site/docs/components/IsometricView.vue';
import type { API } from '../../../packages/ecs/src';
import { settleECSFrames } from './ecs-frames';

let api: API | undefined;
const app = createApp(IsometricView, { locale: 'zh' });
app.mount('#demo');
document.querySelector('ic-spectrum-canvas')!.addEventListener(
  'ic-ready',
  (event) => {
    api = (event as CustomEvent<API>).detail;
  },
  { once: true },
);

const probe = {
  ready: () => !!api?.getNodeById('iso-ring'),
  settle: () => settleECSFrames(api!, 3),
  selectGroup: async () => {
    await api!.edit(
      (editor) => editor.selectMesh3DLayers(['iso-cube', 'iso-ring']),
      { capture: 'NEVER' },
    );
    await settleECSFrames(api!, 3);
    return api!.getSelectedMesh3DLayerIds();
  },
  path: () => {
    const node = api!.getNodeById('iso-ring');
    return node?.type === 'path' ? node.d : undefined;
  },
  undo: async () => {
    api!.undo();
    await settleECSFrames(api!, 3);
  },
  unmount: () => app.unmount(),
};
declare global {
  interface Window {
    isometricDocs: typeof probe;
  }
}
window.isometricDocs = probe;
