<script setup lang="ts">
import {
  Pen,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { ensureExampleWorld } from '../lib/ensure-example-world';
import { Event } from '@infinite-canvas-tutorial/webcomponents';

const wrapper = ref<HTMLElement | null>(null);
const imgWrapper = ref<HTMLImageElement | null>(null);
let api: any | undefined;
let onReady: ((api: CustomEvent<any>) => void) | undefined;

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  // // @see https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Recommended_drag_types#dragging_images
  // img.addEventListener("dragstart", (ev) => {
  //   const dt = ev.dataTransfer;
  //   dt?.setData("text/uri-list", img.src);
  //   dt?.setData("text/plain", img.src);
  // });

  onReady = async (e) => {
    api = e.detail;

    api.setAppState({
      ...api.getAppState(),
      penbarSelected: Pen.SELECT,
      penbarVisible: false,
      taskbarVisible: false,
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
  <div style="display: flex; gap: 20px;">
    <ic-spectrum-canvas ref="wrapper" style="width: 70%; height: 300px"></ic-spectrum-canvas>
    <div style="width: 30%; display: flex; align-items: center; justify-content: center;">
      <img ref="imgWrapper" draggable="true" src="/canvas.png" />
    </div>
  </div>
</template>