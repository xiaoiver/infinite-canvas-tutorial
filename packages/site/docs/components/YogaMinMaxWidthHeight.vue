<script setup lang="ts">
import {
  Pen,
  TRANSFORMER_MASK_FILL_COLOR,
  Task,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { ensureExampleWorld } from '../lib/ensure-example-world';
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

    api.setAppState({
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT],
      taskbarSelected: [
        Task.SHOW_PROPERTIES_PANEL,
      ],
      propertiesPanelSectionsOpen: {
        shape: false,
        transform: false,
        layout: false,
        flexItem: true,
        effects: false,
        multiSelectAlignment: true,
        multiSelectEffects: true,
        exportSection: true,
      },
    });

    const parent = {
      id: 'yoga-min-max-width-height-parent',
      type: 'rect',
      x: 100,
      y: 100,
      fills: [{ type: 'solid', value: 'grey', opacity: 1 }],
      display: 'flex',
      width: 200,
      height: 250,
      padding: 10,
      zIndex: 0,
    } as const;

    const child = {
      id: 'yoga-min-max-width-height-child1',
      parentId: 'yoga-min-max-width-height-parent',
      type: 'rect',
      fills: [{ type: 'solid', value: TRANSFORMER_MASK_FILL_COLOR, opacity: 1 }],
      margin: 5,
      height: 25,
      zIndex: 1,
    } as const;

    const child2 = {
      id: 'yoga-min-max-width-height-child2',
      parentId: 'yoga-min-max-width-height-parent',
      type: 'rect',
      fills: [{ type: 'solid', value: TRANSFORMER_MASK_FILL_COLOR, opacity: 1 }],
      margin: 5,
      height: 100,
      maxHeight: 25,
      zIndex: 1,
    } as const;

    const child3 = {
      id: 'yoga-min-max-width-height-child3',
      parentId: 'yoga-min-max-width-height-parent',
      type: 'rect',
      fills: [{ type: 'solid', value: TRANSFORMER_MASK_FILL_COLOR, opacity: 1 }],
      margin: 5,
      height: 25,
      minHeight: 50,
      zIndex: 1,
    } as const;

    const child4 = {
      id: 'yoga-min-max-width-height-child4',
      parentId: 'yoga-min-max-width-height-parent',
      type: 'rect',
      fills: [{ type: 'solid', value: TRANSFORMER_MASK_FILL_COLOR, opacity: 1 }],
      margin: 5,
      height: 25,
      maxWidth: 25,
      zIndex: 1,
    } as const;

    const child5 = {
      id: 'yoga-min-max-width-height-child5',
      parentId: 'yoga-min-max-width-height-parent',
      type: 'rect',
      fills: [{ type: 'solid', value: TRANSFORMER_MASK_FILL_COLOR, opacity: 1 }],
      margin: 5,
      height: 25,
      width: 25,
      minWidth: 50,
      zIndex: 1,
    } as const;

    api.updateNodes([parent, child, child2, child3, child4, child5]);
    api.selectNodes([child5]);
    api.record();
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
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 500px"
    app-state='{"topbarVisible":true, "cameraY": 50}'>
  </ic-spectrum-canvas>
</template>