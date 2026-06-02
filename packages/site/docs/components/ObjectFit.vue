<script setup lang="ts">
import {
  Pen,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { ensureExampleWorld } from '../lib/ensure-example-world';
import { Event } from '@infinite-canvas-tutorial/webcomponents';

const IMAGE = '/canvas.png';

type ObjectFitMode = 'fill' | 'contain' | 'cover' | 'none' | 'scale-down';

const wrapper = ref<HTMLElement | null>(null);
let api: any | undefined;
let onReady: ((api: CustomEvent<any>) => void) | undefined;

function label(id: string, x: number, y: number, content: string) {
  return {
    id,
    type: 'text',
    anchorX: x,
    anchorY: y,
    content,
    fontSize: 13,
    fontFamily: 'sans-serif',
    fills: [{ type: 'solid', value: '#64748b', opacity: 1 }],
    locked: true,
  };
}

function imageFrame(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  objectFit: ObjectFitMode,
  objectPosition?: string,
) {
  return {
    id,
    type: 'rect',
    x,
    y,
    width,
    height,
    stroke: '#cbd5e1',
    strokeWidth: 1,
    fills: [{
      type: 'image',
      value: IMAGE,
      opacity: 1,
      objectFit,
      ...(objectPosition ? { objectPosition } : {}),
    }],
    lockAspectRatio: true,
  };
}

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  onReady = async (e) => {
    api = e.detail;

    api.setAppState({
      ...api.getAppState(),
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT, Pen.HAND],
      propertiesPanelSectionsOpen: {
        fillSection: true,
      },
    });

    const col1 = 48;
    const col2 = 360;
    const landW = 280;
    const landH = 160;
    const portW = 140;
    const portH = 240;

    const labelY = (row: number) => 32 + row * 300;
    const frameY = (row: number) => 56 + row * 300;

    const nodes = [
      label('h-contain', col1, labelY(0), 'contain — 宽框 (280×160)'),
      label('h-cover', col1, labelY(1), 'cover — 宽框'),
      label('h-fill', col1, labelY(2), 'fill — 拉伸铺满（默认）'),
      label('h-position', col1, labelY(3), 'contain + objectPosition: top left'),

      label('v-contain', col2, labelY(0), 'contain — 高框 (140×240)'),
      label('v-cover', col2, labelY(1), 'cover — 高框'),
      label('v-fill', col2, labelY(2), 'fill — 高框'),
      label('v-scale', col2, labelY(3), 'scale-down — 不放大'),

      imageFrame('contain-land', col1, frameY(0), landW, landH, 'contain'),
      imageFrame('contain-port', col2, frameY(0), portW, portH, 'contain'),

      imageFrame('cover-land', col1, frameY(1), landW, landH, 'cover'),
      imageFrame('cover-port', col2, frameY(1), portW, portH, 'cover'),

      imageFrame('fill-land', col1, frameY(2), landW, landH, 'fill'),
      imageFrame('fill-port', col2, frameY(2), portW, portH, 'fill'),

      imageFrame('pos-land', col1, frameY(3), landW, landH, 'contain', 'top left'),
      imageFrame('scale-port', col2, frameY(3), portW, portH, 'scale-down'),
    ];

    api.runAtNextTick(() => {
      api.updateNodes(nodes);
      api.selectNodes(['contain-land']);
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
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 1200px"></ic-spectrum-canvas>
</template>
