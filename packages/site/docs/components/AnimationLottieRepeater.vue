<script setup lang="ts">
import { ref } from 'vue';
import { useLottieExample } from '../lib/use-lottie-example';

const {
  wrapper,
  playStateLabel,
  diagnostics,
  onPlay,
  onPause,
  onStop,
  onReverse,
  onSeek,
} = useLottieExample('/data/repeater.json');
const seekFrame = ref(0);
</script>

<template>
  <div class="lottie-repeater-demo">
    <div class="toolbar" role="group" aria-label="Repeater playback">
      <span class="state"
        >State: <code>{{ playStateLabel }}</code></span
      >
      <button type="button" @click="onPlay">Play</button>
      <button type="button" @click="onPause">Pause</button>
      <button type="button" @click="onStop">Stop</button>
      <button type="button" @click="onReverse">Reverse</button>
      <label>
        Seek frame
        <input
          v-model.number="seekFrame"
          type="range"
          min="0"
          max="120"
          step="0.25"
          @input="onSeek(seekFrame)"
        />
        <output>{{ seekFrame }}</output>
      </label>
    </div>
    <p>Animated copies · Offset · Scale · Rotation · Opacity</p>
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
      style="display: block; width: 100%; height: 280px"
    />
  </div>
</template>

<style scoped>
.lottie-repeater-demo {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--vp-c-bg-soft);
}
button {
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  padding: 0.2rem 0.6rem;
}
button:hover {
  color: var(--vp-c-brand-1);
}
label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
output {
  min-width: 3rem;
}
p,
.compatibility {
  margin: 0;
  padding: 0.5rem 0.75rem;
}
</style>
