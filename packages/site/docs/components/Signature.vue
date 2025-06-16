<script setup lang="ts">
import {
  App,
  Pen,
  DefaultPlugins,
  loadBitmapFont,
  API,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { Event, UIPlugin } from '@infinite-canvas-tutorial/webcomponents';

const wrapper = ref<HTMLElement | null>(null);
let api: API | undefined;
let onReady: ((api: CustomEvent<any>) => void) | undefined;

onMounted(async () => {
  const res = await window.fetch('/fonts/msdf-sans-serif.json');
  const font = await loadBitmapFont.parse(await res.text());

  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  onReady = async (e) => {
    api = e.detail as API;

    api.setAppState({
      ...api.getAppState(),
      penbarVisible: false,
      taskbarVisible: false,
      rotateEnabled: false,
      flipEnabled: false,
    });
    api.setPen(Pen.SELECT);

    api.loadBitmapFont(font);
    api.updateNodes([
      {
        id: '0',
        type: 'text',
        fontFamily: 'sans-serif',
        fontSize: 300,
        textAlign: 'center',
        textBaseline: 'middle',
        x: 0,
        y: 0,
        width: 300,
        height: 300,
        fill: 'none',
        stroke: 'red',
        strokeWidth: 10,
        content: "H"
      },
      {
        id: '1',
        type: 'text',
        fontFamily: 'sans-serif',
        fontSize: 300,
        textAlign: 'center',
        textBaseline: 'middle',
        x: 0,
        y: 0,
        width: 300,
        height: 300,
        fill: 'none',
        stroke: 'green',
        strokeWidth: 10,
        content: "e"
      }
    ]);
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