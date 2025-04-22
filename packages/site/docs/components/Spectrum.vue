<script setup lang="ts">
import {
  App,
  Pen,
  Task,
  DefaultPlugins,
  svgElementsToSerializedNodes,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { Event, UIPlugin } from '@infinite-canvas-tutorial/webcomponents';

const wrapper = ref<HTMLElement | null>(null);
let api: any | undefined;
let onReady: ((api: CustomEvent<any>) => void) | undefined;

onMounted(async () => {
  const res = await fetch('/maslow-hierarchy.svg');
  const svg = await res.text();
  // TODO: extract semantic groups inside comments
  const $container = document.createElement('div');
  $container.innerHTML = svg;
  const $svg = $container.children[0] as SVGSVGElement;

  const nodes = svgElementsToSerializedNodes(
    Array.from($svg.children) as SVGElement[],
    0,
    [],
    undefined,
  );

  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  onReady = async (e) => {
    api = e.detail;

    api.setPen(Pen.SELECT);
    api.setTaskbars([Task.SHOW_LAYERS_PANEL]);

    api.updateNodes(nodes);
    api.selectNodes([nodes[0].id]);

    api.record();
  };

  canvas.addEventListener(Event.READY, onReady);

  // App only runs once
  if (!(window as any).worldInited) {
    await import('@infinite-canvas-tutorial/webcomponents/spectrum');
    new App().addPlugins(...DefaultPlugins, UIPlugin).run();
    (window as any).worldInited = true;
  }
});

onUnmounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  if (onReady) {
    canvas.removeEventListener(Event.READY, onReady);
  }

  api?.destroy();
});
</script>

<template>
  <div>
    <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 600px"></ic-spectrum-canvas>
  </div>
</template>