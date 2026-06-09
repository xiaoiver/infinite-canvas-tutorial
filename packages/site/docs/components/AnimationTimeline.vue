<script setup lang="ts">
import {
  Pen,
  Task,
  type EllipseSerializedNode,
  type RectSerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { ensureExampleWorld } from '../lib/ensure-example-world';
import { Event } from '@infinite-canvas-tutorial/webcomponents';

const HERO_ID = 'timeline-demo-hero';
const ORBIT_ID = 'timeline-demo-orbit';

const wrapper = ref<HTMLElement | null>(null);
let api: any | undefined;
let onReady: ((e: CustomEvent<any>) => void) | undefined;

const demoNodes: [RectSerializedNode, EllipseSerializedNode] = [
  {
    id: HERO_ID,
    name: 'Hero',
    type: 'rect',
    x: 80,
    y: 48,
    width: 120,
    height: 80,
    fills: [{ type: 'solid', value: '#5151d3', opacity: 1 }],
    stroke: '#1a1a1a',
    strokeWidth: 2,
    zIndex: 10,
    animation: {
      keyframes: [
        { offset: 0, opacity: 0.25 },
        { offset: 1, opacity: 1 },
      ],
      options: { duration: 2000, easing: 'ease-in-out' },
    },
  },
  {
    id: ORBIT_ID,
    name: 'Orbit',
    type: 'ellipse',
    x: 280,
    y: 108,
    width: 48,
    height: 48,
    fills: [{ type: 'solid', value: '#e34850', opacity: 1 }],
    stroke: '#1a1a1a',
    strokeWidth: 2,
    zIndex: 11,
    animation: {
      keyframes: [
        { offset: 0, x: 240, y: 88 },
        { offset: 1, x: 360, y: 128 },
      ],
      options: { duration: 1500, delay: 500, easing: 'ease-out' },
    },
  },
];

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  onReady = (e) => {
    api = e.detail;

    api.runAtNextTick(() => {
      api.setAppState({
        ...api.getAppState(),
        penbarSelected: Pen.SELECT,
        penbarAll: [Pen.SELECT, Pen.HAND],
        taskbarVisible: true,
        taskbarSelected: [
          Task.SHOW_TIMELINE_PANEL,
          Task.SHOW_ANIMATION_PANEL,
        ],
        layersSelected: [HERO_ID],
        animationEditing: true,
        animationCurrentTime: 0,
        animationPlaying: false,
        animationLoop: true,
      });

      api.updateNodes(demoNodes);
      api.record();
    });
  };

  canvas.addEventListener(Event.READY, onReady);

  await ensureExampleWorld();
});

onUnmounted(() => {
  const canvas = wrapper.value;
  if (canvas && onReady) {
    canvas.removeEventListener(Event.READY, onReady);
  }
  api = undefined;
});
</script>

<template>
  <div class="animation-timeline-demo">
    <p class="hint">
      底部为 <code>ic-spectrum-timeline-panel</code>：拖动播放头 scrub、点击 ▶ 预览整场景；
      点击轨道可选中元素并在右侧 Animation 面板编辑 keyframes。Hero 淡入 2s，Orbit 延迟
      0.5s 后位移 1.5s。
    </p>
    <ic-spectrum-canvas ref="wrapper" class="canvas" style="width: 100%; height: 520px" />
  </div>
</template>

<style scoped>
.animation-timeline-demo {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
}

.hint {
  margin: 0;
  padding: 0.65rem 0.85rem;
  font-size: 0.8125rem;
  color: var(--vp-c-text-2);
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
}

.hint code {
  font-size: 0.75rem;
}

.canvas {
  display: block;
}
</style>
