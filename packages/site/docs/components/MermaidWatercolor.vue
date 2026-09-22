<script setup lang="ts">
import {
  Pen,
  RendererPlugin,
  DefaultRendererPlugin,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { ensureExampleWorld } from '../lib/ensure-example-world';
import { Event } from '@infinite-canvas-tutorial/webcomponents';
import {
  InitVello,
  VelloPipeline,
  registerFont,
} from '@infinite-canvas-tutorial/vello';
import { parseMermaidToSerializedNodes } from '@infinite-canvas-tutorial/mermaid';

const wrapper = ref<HTMLElement | null>(null);
let api: any | undefined;
let onReady: ((api: CustomEvent<any>) => void) | undefined;

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  onReady = async (e) => {
    api = e.detail;

    api.setAppState({
      cameraZoom: 0.75,
      cameraX: -200,
      cameraY: -80,
      penbarSelected: Pen.SELECT,
    });

    const mermaidGroup = {
      id: 'mermaid-group',
      type: 'g',
      x: 0,
      y: 0,
      zIndex: 0,
    };
    const mermaidNodes = await parseMermaidToSerializedNodes(`flowchart TD
 A[Christmas] -->|Get money| B(Go shopping)
 B --> C{Let me think}
 C -->|One| D[Laptop]
 C -->|Two| E[iPhone]
 C -->|Three| F[Car]`);
    mermaidNodes.forEach((node) => {
      if (node.type === 'rect') {
        // @ts-expect-error change type
        node.type = 'rough-rect';
        // @ts-expect-error change type
        node.roughFillStyle = 'watercolor';
        node.fills = [{ type: 'solid', value: 'red' }];
      } else if (node.type === 'line') {
        // @ts-expect-error change type
        node.type = 'rough-line';
      } else if (node.type === 'polyline') {
        // @ts-expect-error change type
        node.type = 'rough-polyline';
      } else if (node.type === 'text') {
        node.fontFamily = 'Gaegu';
        node.stroke = 'white';
        node.strokeWidth = 4;
      } else if (node.type === 'path') {
        // @ts-expect-error change type
        node.type = 'rough-path';
        // @ts-expect-error change type
        node.roughFillStyle = 'watercolor';
        node.fills = [{ type: 'solid', value: '#0034ff' }];
      }

      if (!node.parentId) {
        node.parentId = mermaidGroup.id;
      }
    });


    import('webfontloader').then((module) => {
      const WebFont = module.default;
      WebFont.load({
        google: {
          families: ['Gaegu'],
        },
        active: () => {
          api.runAtNextTick(() => {
            api.updateNodes([mermaidGroup, ...mermaidNodes]);
          });
        },
      });
    });
  };

  canvas.addEventListener(Event.READY, onReady);

  await ensureExampleWorld();
});

onUnmounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  if (onReady) {
    canvas.removeEventListener(Event.READY, onReady);
  }

});
</script>

<template>
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 600px"></ic-spectrum-canvas>
</template>
