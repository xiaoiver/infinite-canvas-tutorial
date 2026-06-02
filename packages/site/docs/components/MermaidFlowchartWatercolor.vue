<script setup lang="ts">
import {
  Pen,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { ensureExampleWorld } from '../lib/ensure-example-world';
import { Event } from '@infinite-canvas-tutorial/webcomponents';
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
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT],
    });

    const nodes = await parseMermaidToSerializedNodes(`flowchart TD
 A[Christmas] -->|Get money| B(Go shopping)
 B --> C{Let me think}
 C -->|One| D[Laptop]
 C -->|Two| E[iPhone]
 C -->|Three| F[Car]`);
    nodes.forEach(node => {
      if (node.type === 'rect') {
        // @ts-expect-error change type
        node.type = 'rough-rect';
        // @ts-expect-error change type
        node.roughFillStyle = 'watercolor';
        node.fill = 'red';
      } else if (node.type === 'line') {
        // @ts-expect-error change type
        node.type = 'rough-line';
      } else if (node.type === 'polyline') {
        // @ts-expect-error change type
        node.type = 'rough-polyline';
      } else if (node.type === 'text') {
        node.fontFamily = 'Gaegu';
      } else if (node.type === 'path') {
        // @ts-expect-error change type
        node.type = 'rough-path';
        // @ts-expect-error change type
        node.roughFillStyle = 'watercolor';
        node.fill = '#0034ff';
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
            api.updateNodes(nodes);
          });
        }
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
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 400px"
    app-state='{"topbarVisible":true, "cameraZoom": 0.45, "cameraX": -300, "cameraY": -100}'>
  </ic-spectrum-canvas>
</template>