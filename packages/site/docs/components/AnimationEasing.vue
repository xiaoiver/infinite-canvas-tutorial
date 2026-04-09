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

/** 与 {@link EASING_FUNCTION} 及 spring 解析一致 */
const EASING_PRESETS = [
  { value: 'linear', label: 'linear' },
  { value: 'ease', label: 'ease' },
  { value: 'ease-in', label: 'ease-in' },
  { value: 'ease-out', label: 'ease-out' },
  { value: 'ease-in-out', label: 'ease-in-out' },
  { value: 'spring(1, 100, 10)', label: 'spring' },
] as const;

const DEMO_RECT_ID = 'animation-easing-demo-rect';

const wrapper = ref<HTMLElement | null>(null);
const playStateLabel = ref<string>('—');
const selectedEasing = ref<string>('ease-in-out');

let api: any | undefined;
let onReady: ((e: CustomEvent<any>) => void) | undefined;
let animation: AnimationController | undefined;
let demoNode: RectSerializedNode | undefined;

function refreshState() {
  playStateLabel.value = animation?.getPlayState() ?? '—';
}

function startAnimation() {
  if (!api || !demoNode) {
    return;
  }
  animation = api.animate(
    demoNode,
    [
      { x: 100, fill: 'green' },
      { x: 200, fill: 'red' },
    ],
    {
      duration: 1000,
      direction: 'alternate',
      iterations: 'infinite',
      easing: selectedEasing.value,
    },
  );
  refreshState();
}

function selectEasing(value: string) {
  if (selectedEasing.value === value) {
    return;
  }
  selectedEasing.value = value;
  startAnimation();
}

function onPlay() {
  animation?.play();
  refreshState();
}

function onPause() {
  animation?.pause();
  refreshState();
}

function onFinish() {
  animation?.finish();
  refreshState();
}

function onReverse() {
  animation?.reverse();
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
      y: 80,
      width: 100,
      height: 100,
      fill: 'green',
      stroke: '#1a1a1a',
      strokeWidth: 2,
      zIndex: 10,
    };

    api.updateNodes([demoNode]);
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
  api?.destroy();
});
</script>

<template>
  <div class="animation-easing-demo">
    <div class="toolbar easing-row" role="group" aria-label="缓动曲线">
      <span class="toolbar-label">缓动</span>
      <div class="easing-chips">
        <button
          v-for="preset in EASING_PRESETS"
          :key="preset.value"
          type="button"
          class="chip"
          :class="{ active: selectedEasing === preset.value }"
          :title="preset.value"
          @click="selectEasing(preset.value)"
        >
          {{ preset.label }}
        </button>
      </div>
    </div>
    <div class="toolbar controls-row" role="group" aria-label="播放控制">
      <span class="state">状态：<code>{{ playStateLabel }}</code></span>
      <button type="button" class="btn" @click="onPlay">Play</button>
      <button type="button" class="btn" @click="onPause">Pause</button>
      <button type="button" class="btn" @click="onFinish">Finish</button>
      <button type="button" class="btn" @click="onReverse">Reverse</button>
      <button type="button" class="btn primary" @click="onRestart">Restart</button>
    </div>
    <p class="hint">
      切换缓动会<strong>重新创建</strong>动画（新 <code>easing</code> 在构造时生效）。矩形仍在
      <code>x: 100 ↔ 200</code> 往复，便于对比不同曲线的加减速感。
    </p>
    <ic-spectrum-canvas
      ref="wrapper"
      class="canvas"
      style="width: 100%; height: 280px"
    />
  </div>
</template>

<style scoped>
.animation-easing-demo {
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

.easing-row {
  flex-direction: column;
  align-items: stretch;
  gap: 0.5rem;
}

@media (min-width: 520px) {
  .easing-row {
    flex-direction: row;
    align-items: center;
  }
}

.toolbar-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--vp-c-text-2);
  flex-shrink: 0;
}

.easing-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.chip {
  font-size: 0.75rem;
  padding: 0.3rem 0.55rem;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  cursor: pointer;
}

.chip:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.chip.active {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.controls-row {
  flex-wrap: wrap;
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
