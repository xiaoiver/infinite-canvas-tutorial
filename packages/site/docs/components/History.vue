<script setup lang="ts">
import {
  App,
  Pen,
  DefaultPlugins,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';

const wrapper = ref<HTMLElement | null>(null);
let api: any | undefined;
let onReady: ((api: CustomEvent<any>) => void) | undefined;

onReady = (e) => {
  console.log('ready');

  api = e.detail;

  const node = {
    type: 'rect',
    id: '0',
    fill: 'red',
    stroke: 'black',
    x: 100,
    y: 100,
    width: 100,
    height: 100,
  };

  api.setPen(Pen.SELECT);
  api.setTaskbars(['show-layers-panel']);

  api.updateNodes([node]);
  api.updateNode(node, {
    fill: 'blue',
  });
};

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  console.log('mounted');



  canvas.addEventListener('ic-ready', onReady);

  // App only runs once
  if (!(window as any).worldInited) {
    const { Event, UIPlugin } = await import('@infinite-canvas-tutorial/webcomponents');
    await import('@infinite-canvas-tutorial/webcomponents/spectrum');

    new App().addPlugins(...DefaultPlugins, UIPlugin).run();
    (window as any).worldInited = true;
  }
});

onUnmounted(async () => {


  const canvas = wrapper.value;

  console.log('unmounted', canvas);

  if (!canvas) {
    return;
  }

  if (onReady) {
    canvas.removeEventListener('ic-ready', onReady);
  }

  api?.destroy();

});
</script>

<template>
  <div>
    <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 400px"></ic-spectrum-canvas>
  </div>
</template>