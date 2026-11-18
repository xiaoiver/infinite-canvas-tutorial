import { createApp } from 'vue';
import TextLOD from '../../../packages/site/docs/components/TextLOD.vue';
import type { API } from '../../../packages/ecs/src';

let api: API | undefined;
const locale =
  new URLSearchParams(location.search).get('locale') === 'zh' ? 'zh' : 'en';
let app: ReturnType<typeof createApp> | undefined;
function mount() {
  api = undefined;
  app = createApp(TextLOD, { locale });
  app.mount('#demo');
  document.querySelector('ic-spectrum-canvas')!.addEventListener(
    'ic-ready',
    (event) => {
      api = (event as CustomEvent<API>).detail;
    },
    { once: true },
  );
}
mount();
const probe = {
  ready: () => !!api?.getNodeById('lod-label-0'),
  nodes: () => api!.getNodes(),
  mount,
  unmount() {
    app?.unmount();
    app = undefined;
  },
};
declare global {
  interface Window {
    textLODDemo: typeof probe;
  }
}
window.textLODDemo = probe;
