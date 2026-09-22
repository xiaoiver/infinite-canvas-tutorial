<script setup lang="ts">
import {
  Pen,
  Task,
  svgElementsToSerializedNodes,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { ensureExampleWorld } from '../lib/ensure-example-world';
import { Event } from '@infinite-canvas-tutorial/webcomponents';

const wrapper = ref<HTMLElement | null>(null);
let api: any | undefined;
let onReady: ((api: CustomEvent<any>) => void) | undefined;

onMounted(async () => {
  import('webfontloader').then((module) => {
    const WebFont = module.default;
    WebFont.load({
      google: {
        families: ['Gaegu'],
      },
    });
  });

  const res = await fetch('/maslow-hierarchy.svg');
  const svg = await res.text();
  // TODO: extract semantic groups inside comments
  const $container = document.createElement('div');
  $container.innerHTML = svg;
  const $svg = $container.children[0] as SVGSVGElement;

  const nodes = svgElementsToSerializedNodes(
    Array.from($svg.children) as SVGElement[],
  );

  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  onReady = async (e) => {
    api = e.detail;

    api.runAtNextTick(() => {
      api.setAppState({
        penbarSelected: Pen.SELECT,
        taskbarSelected: [Task.SHOW_LAYERS_PANEL],
        penbarText: {
          fontFamilies: ['system-ui', 'serif', 'monospace', 'Gaegu'],
        },
      });

      api.updateNodes(nodes);
      api.selectNodes([nodes[0]]);

      api.record();
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
  <div>
    <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 600px"></ic-spectrum-canvas>
  </div>
</template>