<script setup lang="ts">
import {
  Pen,
  type API,
  type RectSerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { ensureExampleWorld } from '../lib/ensure-example-world';
import { Event } from '@infinite-canvas-tutorial/webcomponents';

const wrapper = ref<HTMLElement | null>(null);
const props = defineProps<{ locale?: 'en' | 'zh' }>();
const text = computed(() =>
  props.locale === 'zh'
    ? {
        objects: '对象吸附',
        grid: '像素网格',
        distance: '吸附距离（屏幕像素）',
        hint: '拖动中间矩形，或拖动选框的边和角。移出吸附范围即可脱离；Shift 保持比例，Alt 从中心缩放。',
      }
    : {
        objects: 'Object snapping',
        grid: 'Pixel grid',
        distance: 'Snap distance (screen pixels)',
        hint: 'Move the middle rectangle, or drag a selection edge or corner. Move beyond the snap range to release; Shift preserves proportions and Alt resizes from the center.',
      },
);
const objectsEnabled = ref(true);
const gridEnabled = ref(false);
const distance = ref(8);
let api: API | undefined;
let cancelled = false;
let onReady: ((event: CustomEvent<API>) => void) | undefined;

function applyPreferences() {
  api?.setAppState({
    snapToObjectsEnabled: objectsEnabled.value,
    snapToPixelGridEnabled: gridEnabled.value,
    snapToObjectsDistance: distance.value,
  });
}

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  onReady = (e) => {
    if (cancelled) return;
    api = e.detail;

    api.setAppState({
      ...api.getAppState(),
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT, Pen.DRAW_RECT],
      snapToPixelGridEnabled: gridEnabled.value,
      snapToPixelGridSize: 10,
      snapToObjectsEnabled: objectsEnabled.value,
      snapToObjectsDistance: distance.value,
      cameraZoom: Math.min(1, Math.max(1, canvas.clientWidth - 64) / 560),
    });

    const node1: RectSerializedNode = {
      id: 'snap-to-objects-1',
      type: 'rect',
      x: 120,
      y: 100,
      width: 100,
      height: 100,
      fills: [{ type: 'solid', value: '#e0f2ff', opacity: 0.5 }],
      stroke: '#147af3',
      strokeWidth: 1,
      zIndex: 0,
    };
    const node2: RectSerializedNode = {
      id: 'snap-to-objects-2',
      type: 'rect',
      x: 420,
      y: 50,
      width: 100,
      height: 100,
      fills: [{ type: 'solid', value: '#e0f2ff', opacity: 0.5 }],
      stroke: '#147af3',
      strokeWidth: 1,
      zIndex: 0,
    };
    const node3: RectSerializedNode = {
      id: 'snap-to-objects-3',
      type: 'rect',
      x: 270,
      y: 100,
      width: 100,
      height: 100,
      fills: [{ type: 'solid', value: '#e0f2ff', opacity: 0.5 }],
      stroke: '#147af3',
      strokeWidth: 1,
      zIndex: 0,
    };

    api.updateNodes([node1, node2, node3]);
    api.selectNodes([node3]);
    api.record();
  };

  canvas.addEventListener(Event.READY, onReady as EventListener);
  await ensureExampleWorld();
});

onBeforeUnmount(() => {
  cancelled = true;
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  if (onReady) {
    canvas.removeEventListener(Event.READY, onReady as EventListener);
  }
  api = undefined;
});
</script>

<template>
  <div class="snapping-demo">
    <div class="snapping-controls">
      <label
        ><input
          v-model="objectsEnabled"
          type="checkbox"
          @change="applyPreferences"
        />
        {{ text.objects }}</label
      >
      <label
        ><input
          v-model="gridEnabled"
          type="checkbox"
          @change="applyPreferences"
        />
        {{ text.grid }}</label
      >
      <label
        >{{ text.distance }}
        <select v-model.number="distance" @change="applyPreferences">
          <option :value="4">4</option>
          <option :value="8">8</option>
          <option :value="12">12</option>
        </select>
      </label>
    </div>
    <p>{{ text.hint }}</p>
    <ic-spectrum-canvas
      ref="wrapper"
      style="width: 100%; height: 300px"
    ></ic-spectrum-canvas>
  </div>
</template>
<style scoped>
.snapping-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  font-size: 14px;
}
.snapping-controls label {
  display: flex;
  align-items: center;
  gap: 6px;
}
.snapping-controls select {
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  padding: 2px 8px;
}
.snapping-demo p {
  font-size: 14px;
}
</style>
