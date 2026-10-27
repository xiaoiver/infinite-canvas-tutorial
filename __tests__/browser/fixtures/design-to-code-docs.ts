import { createApp } from 'vue';
import type { API } from '../../../packages/ecs/src';
import type { SerializedNode } from '../../../packages/ecs/src';
import { serializedNodesToCode } from '../../../packages/ecs/src/utils/codegen';
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
  paintMarkup: (
    kind:
      | 'opacity'
      | 'scale-down'
      | 'pattern'
      | 'pattern-rotate'
      | 'vector-none'
      | 'vector-scale-down'
      | 'vector-contain'
      | 'vector-opacity'
      | 'vector-blend'
      | 'vector-clip'
      | 'vector-hole',
  ) => {
    const tile = `data:image/svg+xml,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#00ff00"/></svg>',
    )}`;
    const tallTile = `data:image/svg+xml,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="16"><rect width="8" height="16" fill="#00ff00"/></svg>',
    )}`;
    const vector = kind.startsWith('vector-');
    const fills = vector
      ? [
          { type: 'solid', value: '#ff0000' },
          {
            type: 'image',
            value:
              kind === 'vector-contain' || kind === 'vector-hole'
                ? tallTile
                : tile,
            objectFit:
              kind === 'vector-contain' || kind === 'vector-hole'
                ? 'contain'
                : kind === 'vector-scale-down'
                ? 'scale-down'
                : 'none',
            objectPosition: '20% 80%',
            ...(kind === 'vector-opacity' ? { opacity: 0.5 } : {}),
            ...(kind === 'vector-blend' ? { blendMode: 'multiply' } : {}),
          },
        ]
      : kind === 'opacity'
      ? [
          { type: 'solid', value: '#ff0000' },
          {
            type: 'gradient',
            value: 'linear-gradient(90deg, #0000ff, #0000ff)',
            opacity: 0.5,
          },
        ]
      : kind === 'scale-down'
      ? [
          { type: 'solid', value: '#ff0000' },
          { type: 'image', value: tile, objectFit: 'scale-down' },
        ]
      : [
          { type: 'solid', value: '#ff0000' },
          {
            type: 'pattern',
            value: tile,
            repetition: 'no-repeat',
            transform:
              kind === 'pattern-rotate'
                ? 'rotate(90, 20, 20)'
                : 'translate(10, 10)',
          },
        ];
    const node = {
      id: `paint-${kind}`,
      type: vector ? 'path' : 'rect',
      ...(vector
        ? {
            d:
              kind === 'vector-clip'
                ? 'M 0 0 H 60 L 0 60 Z'
                : kind === 'vector-hole'
                ? 'M 0 0 H 60 V 60 H 0 Z M 20 20 H 40 V 40 H 20 Z'
                : 'M 0 0 H 60 V 60 H 0 Z',
            ...(kind === 'vector-hole' ? { fillRule: 'evenodd' } : {}),
          }
        : {}),
      x: 0,
      y: 0,
      zIndex: 0,
      width: 60,
      height: 60,
      fills,
    } as SerializedNode;
    return serializedNodesToCode([node], { framework: 'html-css' });
  },
  scene: () => api?.getNodes().find((node) => !node.parentId)?.id,
  nodes: () => api?.getNodes() ?? [],
  camera: () => api?.getAppState(),
  ordersValueBounds: () => {
    const node = api?.getNodeById('metric-orders-value');
    if (!api || !node) return;
    const bounds = api.getBounds([node]);
    return {
      min: api.canvas2Viewport({ x: bounds.minX, y: bounds.minY }),
      max: api.canvas2Viewport({ x: bounds.maxX, y: bounds.maxY }),
    };
  },
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
