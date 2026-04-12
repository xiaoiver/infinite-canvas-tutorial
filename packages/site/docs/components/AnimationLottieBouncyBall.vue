<script setup lang="ts">
import {
  App,
  Pen,
  DefaultPlugins,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { Event, UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { LaserPointerPlugin } from '@infinite-canvas-tutorial/laser-pointer';
import { LassoPlugin } from '@infinite-canvas-tutorial/lasso';
import { EraserPlugin } from '@infinite-canvas-tutorial/eraser';
import { YogaPlugin } from '@infinite-canvas-tutorial/yoga';
import { loadAnimation } from '@infinite-canvas-tutorial/lottie';

type LottieAnim = ReturnType<typeof loadAnimation>;

const BOUNCY_BALL_URL = '/data/bouncy_ball.json';

const wrapper = ref<HTMLElement | null>(null);
const playStateLabel = ref<string>('—');
/** 1 为正常速度，与 Lottie `setSpeed` 一致 */
const playbackSpeed = ref(1);
let api: any | undefined;
let onReady: ((e: CustomEvent<any>) => void) | undefined;
let animation: LottieAnim | undefined;
/** 与 Lottie `setDirection` 一致：1 正向，-1 反向 */
let playbackDirection: 1 | -1 = 1;

function applyPlaybackSpeed() {
  if (!animation) {
    return;
  }
  animation.setSpeed(playbackSpeed.value);
}

function runningLabel() {
  return playbackDirection === 1 ? 'running' : 'running (reverse)';
}

function loadAndPlayLottie() {
  if (!api) {
    return;
  }
  fetch(BOUNCY_BALL_URL)
    .then((res) => {
      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`);
      }
      return res.json();
    })
    .then((data) => {
      animation = loadAnimation(data, {
        loop: true,
        autoplay: true,
      });
      playbackDirection = 1;

      api.runAtNextTick(() => {
        animation!.render(api);
        animation!.setDirection(playbackDirection);
        animation!.setSpeed(playbackSpeed.value);
        animation!.play();
        playStateLabel.value = 'running';
      });
    })
    .catch(() => {
      playStateLabel.value = 'load error';
    });
}

function onPlay() {
  animation?.play();
  if (animation) {
    playStateLabel.value = runningLabel();
  }
}

function onPause() {
  animation?.pause();
  if (animation) {
    playStateLabel.value = 'paused';
  }
}

function onFinish() {
  animation?.stop();
  if (animation) {
    playStateLabel.value = 'finished';
  }
}

function onReverse() {
  if (!animation) {
    return;
  }
  playbackDirection = playbackDirection === 1 ? -1 : 1;
  animation.setDirection(playbackDirection);
  animation.setSpeed(playbackSpeed.value);
  animation.play();
  playStateLabel.value = runningLabel();
}

/** 从头播放；若尚未加载则拉取 Lottie JSON */
function onRestart() {
  if (animation) {
    animation.goTo(0, true);
    animation.setDirection(playbackDirection);
    animation.setSpeed(playbackSpeed.value);
    animation.play();
    playStateLabel.value = runningLabel();
    return;
  }
  loadAndPlayLottie();
}

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  onReady = (e: CustomEvent<any>) => {
    api = e.detail;

    api.setAppState({
      ...api.getAppState(),
      cameraZoom: 0.5,
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT, Pen.HAND],
    });

    loadAndPlayLottie();
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
  <div class="lottie-bouncy-ball-demo">
    <div class="toolbar" role="group" aria-label="Lottie 动画控制">
      <span class="state">State:<code>{{ playStateLabel }}</code></span>
      <button type="button" class="btn" @click="onPlay">Play</button>
      <button type="button" class="btn" @click="onPause">Pause</button>
      <button type="button" class="btn" @click="onFinish">Stop</button>
      <button type="button" class="btn" @click="onReverse">Reverse</button>
      <button type="button" class="btn primary" @click="onRestart">Restart</button>
      <label class="speed">
        <span class="speed-label">Speed</span>
        <input v-model.number="playbackSpeed" class="speed-range" type="range" min="0.25" max="3" step="0.25"
          @input="applyPlaybackSpeed" />
        <code class="speed-value">{{ playbackSpeed.toFixed(2) }}×</code>
      </label>
    </div>
    <ic-spectrum-canvas ref="wrapper" class="canvas" style="width: 100%; height: 280px" />
  </div>
</template>

<style scoped>
.lottie-bouncy-ball-demo {
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

.speed {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8125rem;
  color: var(--vp-c-text-2);
}

.speed-label {
  flex-shrink: 0;
}

.speed-range {
  width: 7rem;
  vertical-align: middle;
}

.speed-value {
  min-width: 2.75rem;
  font-size: 0.75rem;
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
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
