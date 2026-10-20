<script setup lang="ts">
import {
  Pen,
  type API,
  type SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { Event } from '@infinite-canvas-tutorial/webcomponents';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { ensureExampleWorld } from '../lib/ensure-example-world';

const props = withDefaults(defineProps<{ locale?: 'en' | 'zh' }>(), {
  locale: 'en',
});
const copy = {
  en: {
    cutoff: 'Mask cutoff',
    opacity: 'Glass opacity',
    shadows: 'Cast shadows',
    hint: 'The green cutout uses texture alpha for both its visible shape and shadow. The red and blue panes overlap: the closer red pane should blend over the blue one.',
  },
  zh: {
    cutoff: '遮罩阈值',
    opacity: '玻璃透明度',
    shadows: '投射阴影',
    hint: '绿色镂空图形的显示与阴影都使用贴图 alpha。红蓝玻璃相互重叠，距离相机更近的红色玻璃应叠在蓝色之上。',
  },
} as const;
const t = computed(() => copy[props.locale]);
const wrapper = ref<HTMLElement | null>(null);
const cutoff = ref(0.5);
const opacity = ref(0.45);
const shadows = ref(true);
let api: API | undefined;
let canvasElement: HTMLElement | undefined;
let onReady: ((event: CustomEvent<API>) => void) | undefined;

const scene: SerializedNode[] = [
  {
    id: 'alpha-ambient',
    type: 'light3d',
    lightType: 'ambient',
    intensity: 0.45,
  },
  {
    id: 'alpha-sun',
    type: 'light3d',
    lightType: 'directional',
    direction: [0.4, 0.65, 0.6],
    intensity: 1.8,
    castShadow: true,
    shadowSoftness: 1,
  },
  {
    id: 'alpha-floor',
    type: 'mesh3d',
    geometry: { type: 'plane' },
    x: 0,
    y: 0,
    width: 440,
    height: 350,
    z: 100,
    scale3d: [440, 350, 1],
    rotation3d: [0, Math.PI, 0],
    material3d: { baseColor: '#d6dce6', roughness: 1, castShadow: false },
    camera3d: { linked: true, projection: 'perspective', clearColor: false },
  },
  {
    id: 'alpha-cutout',
    type: 'mesh3d',
    geometry: { type: 'plane' },
    x: 36,
    y: 77,
    width: 150,
    height: 150,
    z: 25,
    scale3d: [150, 150, 1],
    rotation3d: [0, Math.PI, 0],
    material3d: {
      map: '/mesh3d-alpha-mask.svg',
      alphaMode: 'mask',
      alphaCutoff: 0.5,
      roughness: 0.8,
      castShadow: true,
    },
  },
  {
    id: 'alpha-near',
    type: 'mesh3d',
    geometry: { type: 'plane' },
    x: 235,
    y: 95,
    width: 150,
    height: 170,
    z: 0,
    scale3d: [150, 170, 1],
    rotation3d: [0, Math.PI, 0],
    material3d: {
      baseColor: [1, 0.2, 0.16, 0.45],
      alphaMode: 'blend',
      roughness: 0.5,
      castShadow: true,
    },
  },
  {
    id: 'alpha-far',
    type: 'mesh3d',
    geometry: { type: 'plane' },
    x: 190,
    y: 76,
    width: 150,
    height: 170,
    z: 50,
    scale3d: [150, 170, 1],
    rotation3d: [0, Math.PI, 0],
    material3d: {
      baseColor: [0.13, 0.5, 1, 0.45],
      alphaMode: 'blend',
      roughness: 0.5,
      castShadow: true,
    },
  },
];

function apply() {
  if (!api) return;
  const cutout = api.getNodeById('alpha-cutout');
  if (cutout)
    api.updateNode(
      cutout,
      {
        material3d: {
          map: '/mesh3d-alpha-mask.svg',
          alphaMode: 'mask',
          alphaCutoff: cutoff.value,
          roughness: 0.8,
          castShadow: shadows.value,
        },
      },
      false,
    );
  for (const [id, color] of [
    ['alpha-near', [1, 0.2, 0.16, opacity.value]],
    ['alpha-far', [0.13, 0.5, 1, opacity.value]],
  ] as const) {
    const node = api.getNodeById(id);
    if (node)
      api.updateNode(
        node,
        {
          material3d: {
            baseColor: [...color] as [number, number, number, number],
            alphaMode: 'blend',
            roughness: 0.5,
            castShadow: shadows.value,
          },
        },
        false,
      );
  }
}
watch([cutoff, opacity, shadows], apply);

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) return;
  canvasElement = canvas;
  onReady = (event) => {
    if (api) return;
    api = event.detail;
    api.setAppState({
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT, Pen.HAND],
      penbarVisible: false,
      taskbarVisible: false,
    });
    api.runAtNextTick(() => {
      api?.updateNodes(scene);
      api?.runAtNextTick(apply);
    });
  };
  canvas.addEventListener(Event.READY, onReady as EventListener);
  await ensureExampleWorld();
});

onUnmounted(() => {
  if (canvasElement && onReady)
    canvasElement.removeEventListener(Event.READY, onReady as EventListener);
  api = undefined;
});
</script>

<template>
  <div class="mesh-alpha-demo">
    <div class="controls">
      <label>
        <span>{{ t.cutoff }}: {{ cutoff.toFixed(2) }}</span>
        <input
          v-model.number="cutoff"
          type="range"
          min="0"
          max="1"
          step="0.05"
        />
      </label>
      <label>
        <span>{{ t.opacity }}: {{ opacity.toFixed(2) }}</span>
        <input
          v-model.number="opacity"
          type="range"
          min="0"
          max="1"
          step="0.05"
        />
      </label>
      <label class="checkbox">
        <input v-model="shadows" type="checkbox" />
        <span>{{ t.shadows }}</span>
      </label>
    </div>
    <p>{{ t.hint }}</p>
    <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 360px" />
  </div>
</template>

<style scoped>
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  align-items: end;
}
.controls label {
  display: grid;
  gap: 4px;
  font-size: 13px;
}
.controls input[type='range'] {
  width: 150px;
}
.controls .checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
}
.mesh-alpha-demo p {
  margin: 10px 0;
  font-size: 13px;
}
</style>
