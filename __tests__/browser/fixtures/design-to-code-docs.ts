import { createApp } from 'vue';
import type { API } from '../../../packages/ecs/src';
import DesignToCodeInterfaces from '../../../packages/site/docs/components/DesignToCodeInterfaces.vue';

let api: API | undefined;
const root = document.querySelector('#demo')!;
root.addEventListener(
  'ic-ready',
  (event) => {
    api = (event as CustomEvent<API>).detail;
  },
  { capture: true },
);
createApp(DesignToCodeInterfaces, { locale: 'zh' }).mount(root);

const probe = {
  scene: () => api?.getNodes().find((node) => !node.parentId)?.id,
  nodes: () => api?.getNodes() ?? [],
  camera: () => api?.getAppState(),
  editPay: async (content: string) => {
    if (!api) throw new Error('Editor is not ready');
    await api.edit((editor) => {
      const node = editor.getNodeById('checkout-pay-label');
      if (node?.type !== 'text') throw new Error('Checkout label is missing');
      editor.updateNode(node, { content });
    });
  },
};
declare global {
  interface Window {
    designToCodeDocs: typeof probe;
  }
}
window.designToCodeDocs = probe;
