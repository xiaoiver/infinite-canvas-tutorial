<script setup lang="ts">
import { Pen, VectorNetworkEditMode } from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { ensureExampleWorld } from '../lib/ensure-example-world';
import { createVectorNetworkCubeNode } from '../lib/vector-network-cube';
import { Event } from '@infinite-canvas-tutorial/webcomponents';

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

    const cube = createVectorNetworkCubeNode();

    api.setAppState({
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT, Pen.VECTOR_NETWORK],
      vectorNetworkEditMode: VectorNetworkEditMode.MOVE,
      cameraX: -120,
      cameraY: -80,
    });

    api.updateNodes([cube]);
    api.selectNodes([cube]);
    api.updateNode({ ...cube, isEditing: true });
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
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 360px"></ic-spectrum-canvas>
</template>
