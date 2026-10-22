<script setup lang="ts">
import {
  Pen,
  svgElementsToExtrudedNodes,
  type API,
  type AxonometricPreset,
  type SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { Event } from '@infinite-canvas-tutorial/webcomponents';
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { ensureExampleWorld } from '../lib/ensure-example-world';

const props = withDefaults(defineProps<{ locale?: 'en' | 'zh' }>(), {
  locale: 'en',
});
const wrapper = ref<HTMLElement | null>(null);
const preset = ref<AxonometricPreset>('isometric');
const height = ref(380);
const distance = ref(650);
const tool = ref<Pen.SELECT | Pen.HAND>(Pen.SELECT);
let api: API | undefined;
let onReady: ((event: CustomEvent<API>) => void) | undefined;

function applyCamera() {
  api?.setCamera3D({
    preset: preset.value,
    center: [245, 180, 15],
    distance: distance.value,
    orthographicHeight: height.value,
    clearColor: false,
  });
}
watch([preset, height, distance], applyCamera);

function setTool(next: Pen.SELECT | Pen.HAND) {
  tool.value = next;
  api?.setAppState({ penbarSelected: next });
}

const scene: SerializedNode[] = [
  { id: 'iso-ambient', type: 'light3d', lightType: 'ambient', intensity: 0.7 },
  {
    id: 'iso-sun',
    type: 'light3d',
    lightType: 'directional',
    direction: [0.5, 0.4, -1],
    intensity: 1.5,
    castShadow: true,
  },
  {
    id: 'iso-ground',
    type: 'mesh3d',
    geometry: { type: 'plane' },
    x: 0,
    y: 0,
    width: 490,
    height: 360,
    z: -50,
    scale3d: [490, 360, 1],
    material3d: {
      baseColor: '#e6ebef',
      roughness: 1,
      castShadow: false,
      receiveShadow: true,
    },
  },
  {
    id: 'iso-cube',
    name: 'Cube',
    type: 'mesh3d',
    geometry: { type: 'cube' },
    x: 125,
    y: 105,
    width: 100,
    height: 100,
    z: 10,
    scale3d: 100,
    material3d: { baseColor: '#4774df', roughness: 0.8, castShadow: true },
  },
];

function svgNodes(): SerializedNode[] {
  const svg = new DOMParser().parseFromString(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 490 360"><path id="iso-ring" d="M290 115 H390 V215 H290 Z M318 143 H362 V187 H318 Z" fill="#ee9950" fill-rule="evenodd"/></svg>',
    'image/svg+xml',
  ).documentElement as unknown as SVGSVGElement;
  return svgElementsToExtrudedNodes(svg, 50).map((node) =>
    node.id === 'iso-ring' ? { ...node, name: 'Extruded SVG ring' } : node,
  );
}

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) return;
  onReady = (event) => {
    api = event.detail;
    api.setAppState({
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT, Pen.HAND],
      penbarVisible: false,
      penbarNameLabelVisible: true,
      taskbarVisible: false,
    });
    api.runAtNextTick(() => {
      applyCamera();
      api?.updateNodes([...scene, ...svgNodes()]);
    });
  };
  canvas.addEventListener(Event.READY, onReady as EventListener);
  await ensureExampleWorld();
});
onUnmounted(() => {
  if (wrapper.value && onReady)
    wrapper.value.removeEventListener(Event.READY, onReady as EventListener);
  api = undefined;
});
</script>

<template>
  <div class="isometric-controls">
    <div class="isometric-tools">
      <button :aria-pressed="tool === Pen.SELECT" @click="setTool(Pen.SELECT)">
        {{ props.locale === 'zh' ? '选择' : 'Select' }}
      </button>
      <button :aria-pressed="tool === Pen.HAND" @click="setTool(Pen.HAND)">
        {{ props.locale === 'zh' ? '平移 / 旋转' : 'Pan / orbit' }}
      </button>
    </div>
    <label
      >{{ props.locale === 'zh' ? '视角' : 'View' }}
      <select v-model="preset">
        <option value="isometric">
          {{
            props.locale === 'zh'
              ? '严格等距 35.264°'
              : 'True isometric 35.264°'
          }}
        </option>
        <option value="dimetric-2-1">
          {{ props.locale === 'zh' ? '2:1 二轴测 30°' : '2:1 dimetric 30°' }}
        </option>
      </select>
    </label>
    <label
      >{{ props.locale === 'zh' ? '视图高度' : 'View height' }}
      <input
        v-model.number="height"
        type="range"
        min="250"
        max="650"
        step="10"
      />
      {{ height }}
    </label>
    <label
      >{{ props.locale === 'zh' ? '相机距离' : 'Camera distance' }}
      <input
        v-model.number="distance"
        type="range"
        min="450"
        max="850"
        step="25"
      />
      {{ distance }}
    </label>
  </div>
  <p class="isometric-hint">
    {{
      props.locale === 'zh'
        ? '使用“平移 / 旋转”拖动画布；按住 Shift 拖动可转动视角。滚轮缩放，Shift + 滚轮平移；双指可平移与缩放。'
        : 'Drag with Pan / orbit to move the view; hold Shift while dragging to orbit. Wheel zooms, Shift + wheel pans, and two fingers pan or pinch to zoom.'
    }}
  </p>
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 400px" />
</template>

<style scoped>
.isometric-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin: 0.75rem 0;
}
.isometric-controls label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.isometric-tools {
  display: flex;
  gap: 0.3rem;
}
.isometric-tools button {
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 0.3rem;
}
.isometric-tools button[aria-pressed='true'] {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}
.isometric-hint {
  margin: 0 0 0.75rem;
  font-size: 0.9em;
}
</style>
