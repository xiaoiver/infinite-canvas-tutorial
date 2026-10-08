<script setup lang="ts">
import { useLottieExample } from '../lib/use-lottie-example';

const {
  wrapper,
  playStateLabel,
  playbackSpeed,
  diagnostics,
  onPlay,
  onPause,
  onStop,
  onReverse,
  onRestart,
  applyPlaybackSpeed,
} = useLottieExample('/data/bouncy_ball.json', 0);
</script>

<template>
  <div class="lottie-bouncy-ball-demo">
    <div class="toolbar" role="group" aria-label="Lottie 动画控制">
      <span class="state"
        >State:<code>{{ playStateLabel }}</code></span
      >
      <button type="button" class="btn" @click="onPlay">Play</button>
      <button type="button" class="btn" @click="onPause">Pause</button>
      <button type="button" class="btn" @click="onStop">Stop</button>
      <button type="button" class="btn" @click="onReverse">Reverse</button>
      <button type="button" class="btn primary" @click="onRestart">
        Restart
      </button>
      <label class="speed">
        <span class="speed-label">Speed</span>
        <input
          v-model.number="playbackSpeed"
          class="speed-range"
          type="range"
          min="0.25"
          max="3"
          step="0.25"
          @input="applyPlaybackSpeed"
        />
        <code class="speed-value">{{ playbackSpeed.toFixed(2) }}×</code>
      </label>
    </div>
    <details v-if="diagnostics.length" class="compatibility">
      <summary>Compatibility notes ({{ diagnostics.length }})</summary>
      <ul>
        <li v-for="item in diagnostics" :key="`${item.code}:${item.path}`">
          <code>{{ item.path }}</code
          >: {{ item.message }}
        </li>
      </ul>
    </details>
    <ic-spectrum-canvas
      ref="wrapper"
      class="canvas"
      style="width: 100%; height: 280px"
    />
  </div>
</template>

<style scoped>
.compatibility {
  padding: 0.65rem 0.85rem;
  font-size: 0.875rem;
}
.compatibility code {
  overflow-wrap: anywhere;
}
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
