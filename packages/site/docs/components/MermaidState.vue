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

    const nodes = await parseMermaidToSerializedNodes(`stateDiagram-v2
    classDef yourState fill:#ffec99,stroke:#c92a2a,color:#1864ab,stroke-width:2px
    yswsii: Your state with spaces in it
    [*] --> yswsii:::yourState
    [*] --> SomeOtherState
    SomeOtherState --> YetAnotherState
    yswsii --> YetAnotherState
    YetAnotherState --> [*]`);
    nodes.forEach(node => {
      if (node.type === 'rect') {
        // @ts-expect-error change type
        node.type = 'rough-rect';
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
    app-state='{"topbarVisible":true, "cameraZoom": 0.8, "cameraX": -200, "cameraY": -100}'>
  </ic-spectrum-canvas>
</template>