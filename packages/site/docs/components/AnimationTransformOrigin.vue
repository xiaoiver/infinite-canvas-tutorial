<script setup lang="ts">
import {
  App,
  Pen,
  DefaultPlugins,
  type AnimationController,
  type RectSerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { Event, UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { LaserPointerPlugin } from '@infinite-canvas-tutorial/laser-pointer';
import { LassoPlugin } from '@infinite-canvas-tutorial/lasso';
import { EraserPlugin } from '@infinite-canvas-tutorial/eraser';
import { YogaPlugin } from '@infinite-canvas-tutorial/yoga';

const DEMO_RECT_ID = 'animation-transform-origin-demo-rect';

const wrapper = ref<HTMLElement | null>(null);
const playStateLabel = ref<string>('—');
let api: any | undefined;
let onReady: ((e: CustomEvent<any>) => void) | undefined;
let animation: AnimationController | undefined;
let animation2: AnimationController | undefined;
let demoNode: RectSerializedNode | undefined;
let demoNode2: RectSerializedNode | undefined;

function refreshState() {
  playStateLabel.value = animation?.getPlayState() ?? '—';
}

function startAnimation() {
  if (!api || !demoNode || !demoNode2) {
    return;
  }
  animation = api.animate(
    demoNode,
    [
      { scale: 0.5 },
      { scale: 1.2 },
    ],
    {
      duration: 1000,
      direction: 'alternate',
      iterations: 'infinite',
      easing: 'ease-in-out',
      transformOrigin: { x: 50, y: 50 },
    },
  );

  animation2 = api.animate(
    demoNode2,
    [
      { rotation: Math.PI / 4 },
      { rotation: -Math.PI / 4 },
    ],
    {
      duration: 1000,
      direction: 'alternate',
      iterations: 'infinite',
      easing: 'ease-in-out',
      transformOrigin: { x: 50, y: 50 },
    },
  );
  refreshState();
}

function onPlay() {
  animation?.play();
  animation2?.play();
  refreshState();
}

function onPause() {
  animation?.pause();
  animation2?.pause();
  refreshState();
}

function onFinish() {
  animation?.finish();
  animation2?.finish();
  refreshState();
}

function onReverse() {
  animation?.reverse();
  animation2?.reverse();
  refreshState();
}

function onRestart() {
  startAnimation();
}

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  onReady = (e) => {
    api = e.detail;

    api.setAppState({
      ...api.getAppState(),
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT, Pen.HAND],
    });

    demoNode = {
      id: DEMO_RECT_ID,
      type: 'rect',
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      fill: 'green',
      stroke: '#1a1a1a',
      strokeWidth: 2,
      zIndex: 10,
    };

    demoNode2 = {
      id: DEMO_RECT_ID + '-2',
      type: 'rect',
      x: 300,
      y: 100,
      width: 100,
      height: 100,
      fill: 'green',
      stroke: '#1a1a1a',
      strokeWidth: 2,
      zIndex: 10,
    };

    api.updateNodes([demoNode, demoNode2]);
    startAnimation();
  };

  canvas.addEventListener(Event.READY, onReady);

  if (!(window as any).worldInited) {
    (window as any).worldInited = true;
    await import('@infinite-canvas-tutorial/webcomponents/spectrum');
    await import('@infinite-canvas-tutorial/lasso/spectrum');
    await import('@infinite-canvas-tutorial/eraser/spectrum');
    await import('@infinite-canvas-tutorial/laser-pointer/spectrum');
    new App()
      .addPlugins(
        ...DefaultPlugins,
        UIPlugin,
        LaserPointerPlugin,
        LassoPlugin,
        EraserPlugin,
        YogaPlugin,
      )
      .run();
  }
});

onUnmounted(() => {
  const canvas = wrapper.value;
  if (canvas && onReady) {
    canvas.removeEventListener(Event.READY, onReady);
  }
  animation = undefined;
  animation2 = undefined;
  api?.destroy();
});
</script>

<template>
  <div class="animation-controller-demo">
    <div class="toolbar" role="group" aria-label="动画控制器">
      <span class="state">状态：<code>{{ playStateLabel }}</code></span>
      <button type="button" class="btn" @click="onPlay">Play</button>
      <button type="button" class="btn" @click="onPause">Pause</button>
      <button type="button" class="btn" @click="onFinish">Finish</button>
      <button type="button" class="btn" @click="onReverse">Reverse</button>
      <button type="button" class="btn primary" @click="onRestart">Restart</button>
    </div>
    <p class="hint">
      <code>transformOrigin: { x: 50, y: 50 }</code><br />
      <code>scale: 0.5 ↔ 1.2</code>
      <code>rotation: Math.PI / 4 ↔ -Math.PI / 4</code>
    </p>
    <ic-spectrum-canvas ref="wrapper" class="canvas" style="width: 100%; height: 280px" />
  </div>
</template>

<style scoped>
.animation-controller-demo {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  padding: 0.65rem 0.85rem;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
}

.state {
  font-size: 0.875rem;
  margin-right: 0.25rem;
}

.state code {
  font-size: 0.8125rem;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
}

.btn {
  font-size: 0.8125rem;
  padding: 0.35rem 0.65rem;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
}

.btn:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.btn.primary {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

.hint {
  margin: 0;
  padding: 0.5rem 0.85rem;
  font-size: 0.8125rem;
  color: var(--vp-c-text-2);
  border-bottom: 1px solid var(--vp-c-divider);
}

.hint code {
  font-size: 0.75rem;
}

.canvas {
  display: block;
}
</style>
