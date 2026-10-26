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
  setZoom: (cameraZoom: number) => api?.setAppState({ cameraZoom }),
  editPay: async (content: string) => {
    if (!api) throw new Error('Editor is not ready');
    await api.edit((editor) => {
      const node = editor.getNodeById('checkout-pay-label');
      if (node?.type !== 'text') throw new Error('Checkout label is missing');
      editor.updateNode(node, { content });
    });
  },
  editPricingAmount: async (content: string) => {
    if (!api) throw new Error('Editor is not ready');
    await api.edit((editor) => {
      const node = editor.getNodeById('plan-growth__plan-card-amount');
      if (node?.type !== 'text') throw new Error('Growth price is missing');
      editor.updateNode(node, { content });
    });
  },
  resizePricingCard: async (width: number) => {
    if (!api) throw new Error('Editor is not ready');
    await api.edit((editor) => {
      const node = editor.getNodeById('plan-growth');
      if (node?.type !== 'rect') throw new Error('Growth card is missing');
      editor.updateNode(node, { width });
    });
  },
  setPricingCardOpacity: async (opacity: number) => {
    if (!api) throw new Error('Editor is not ready');
    await api.edit((editor) => {
      const node = editor.getNodeById('plan-growth');
      if (node?.type !== 'rect') throw new Error('Growth card is missing');
      editor.updateNode(node, { opacity });
    });
  },
  setPricingCardBlendMode: async () => {
    if (!api) throw new Error('Editor is not ready');
    await api.edit((editor) => {
      const node = editor.getNodeById('plan-growth');
      if (node?.type !== 'rect') throw new Error('Growth card is missing');
      editor.updateNode(node, { blendMode: 'multiply' });
    });
  },
  setPricingAmountWeight: async (fontWeight: number) => {
    if (!api) throw new Error('Editor is not ready');
    await api.edit((editor) => {
      const node = editor.getNodeById('plan-growth__plan-card-amount');
      if (node?.type !== 'text') throw new Error('Growth price is missing');
      editor.updateNode(node, { fontWeight });
    });
  },
  setPricingCardShadow: async () => {
    if (!api) throw new Error('Editor is not ready');
    await api.edit((editor) => {
      const node = editor.getNodeById('plan-growth');
      if (node?.type !== 'rect') throw new Error('Growth card is missing');
      editor.updateNode(node, {
        dropShadowColor: '#000000',
        dropShadowOffsetY: 6,
        dropShadowBlurRadius: 12,
      });
    });
  },
  setPricingCardPadding: async (padding: number) => {
    if (!api) throw new Error('Editor is not ready');
    await api.edit((editor) => {
      const node = editor.getNodeById('plan-growth');
      if (node?.type !== 'rect') throw new Error('Growth card is missing');
      editor.updateNode(node, { padding });
    });
  },
  setPricingCardJustification: async () => {
    if (!api) throw new Error('Editor is not ready');
    await api.edit((editor) => {
      const node = editor.getNodeById('plan-growth');
      if (node?.type !== 'rect') throw new Error('Growth card is missing');
      editor.updateNode(node, { justifyContent: 'space-between' });
    });
  },
  setPricingPriceFlexItem: async () => {
    if (!api) throw new Error('Editor is not ready');
    await api.edit((editor) => {
      const node = editor.getNodeById('plan-growth__plan-card-price');
      if (node?.type !== 'rect') throw new Error('Growth price row is missing');
      editor.updateNode(node, {
        alignSelf: 'center',
        flexGrow: 1,
        flexShrink: 0,
        flexBasis: 140,
      });
    });
  },
  setPricingActionConstraints: async () => {
    if (!api) throw new Error('Editor is not ready');
    await api.edit((editor) => {
      const node = editor.getNodeById('plan-growth__plan-card-action');
      if (node?.type !== 'rect') throw new Error('Growth action is missing');
      editor.updateNode(node, {
        minWidth: 250,
        maxWidth: 300,
        minHeight: 40,
        maxHeight: 52,
      });
    });
  },
  setPricingAmountTypography: async () => {
    if (!api) throw new Error('Editor is not ready');
    await api.edit((editor) => {
      const node = editor.getNodeById('plan-growth__plan-card-amount');
      if (node?.type !== 'text') throw new Error('Growth price is missing');
      editor.updateNode(node, {
        fontStyle: 'italic',
        fontFamily: 'Georgia',
        textAlign: 'center',
        letterSpacing: 1.5,
        lineHeight: 48,
      });
    });
  },
  setPricingAmountDecoration: async () => {
    if (!api) throw new Error('Editor is not ready');
    await api.edit((editor) => {
      const node = editor.getNodeById('plan-growth__plan-card-amount');
      if (node?.type !== 'text') throw new Error('Growth price is missing');
      editor.updateNode(node, {
        decorationLine: 'underline',
        decorationStyle: 'wavy',
        decorationColor: '#ffcc66',
        decorationThickness: 2,
      });
    });
  },
  setPricingAmountFontFeatures: async () => {
    if (!api) throw new Error('Editor is not ready');
    await api.edit((editor) => {
      const node = editor.getNodeById('plan-growth__plan-card-amount');
      if (node?.type !== 'text') throw new Error('Growth price is missing');
      editor.updateNode(node, {
        fontVariant: 'small-caps',
        fontKerning: false,
      });
    });
  },
  setPricingAmountWrap: async () => {
    if (!api) throw new Error('Editor is not ready');
    await api.edit((editor) => {
      const node = editor.getNodeById('plan-growth__plan-card-amount');
      if (node?.type !== 'text') throw new Error('Growth price is missing');
      editor.updateNode(node, {
        content: 'A longer price label\nwith two lines',
        wordWrap: true,
        wordWrapWidth: 140,
      });
    });
  },
};
declare global {
  interface Window {
    designToCodeDocs: typeof probe;
  }
}
window.designToCodeDocs = probe;
