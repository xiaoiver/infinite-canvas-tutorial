<script setup lang="ts">
import {
  Pen,
  type API,
  type SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { ensureExampleWorld } from '../lib/ensure-example-world';
import { Event } from '@infinite-canvas-tutorial/webcomponents';

type LightMode = 'all' | 'ambient' | 'directional' | 'point' | 'spot';
const props = withDefaults(defineProps<{ locale?: 'en' | 'zh' }>(), {
  locale: 'en',
});
const copy = {
  en: {
    controls: 'Lighting controls',
    mode: 'Light source',
    intensity: 'Intensity',
    range: 'Point and spot range',
    cone: 'Spot outer angle',
    attenuation: 'Distance falloff',
    rangeFalloff: 'Smooth range (legacy)',
    inverseSquare: 'Inverse square',
    metallic: 'Sphere metalness',
    roughness: 'Sphere roughness',
    environment: 'Studio environment',
    hdr: 'HDR studio',
    ldr: 'LDR studio',
    off: 'Off',
    shadows: 'Cast shadows',
    sphereCastsShadow: 'Sphere casts shadow',
    floorReceivesShadow: 'Floor receives shadow',
    shadowStrength: 'Shadow strength',
    shadowSoftness: 'Shadow softness',
    shadowBiasScale: 'Depth bias ×',
    shadowNormalBias: 'Normal offset',
    play: 'Animate spot',
    pause: 'Pause spot',
    all: 'All lights',
    ambient: 'Ambient only',
    directional: 'Directional + ambient',
    point: 'Point + ambient',
    spot: 'Spot + ambient',
    hint: 'The cube is a rough dielectric, the sphere is a metal, and the cylinder is a smooth dielectric. Toggle the sphere caster and floor receiver independently. Compare HDR and LDR panoramas on the sphere.',
  },
  zh: {
    controls: '光照控制',
    mode: '光源类型',
    intensity: '强度',
    range: '点光与聚光灯范围',
    cone: '聚光灯外锥半角',
    attenuation: '距离衰减',
    rangeFalloff: '平滑范围（原有）',
    inverseSquare: '逆平方',
    metallic: '球体金属度',
    roughness: '球体粗糙度',
    environment: '摄影棚环境光照',
    hdr: 'HDR 摄影棚',
    ldr: 'LDR 摄影棚',
    off: '关闭',
    shadows: '投射阴影',
    sphereCastsShadow: '球体投射阴影',
    floorReceivesShadow: '地板接收阴影',
    shadowStrength: '阴影强度',
    shadowSoftness: '阴影柔化',
    shadowBiasScale: '深度偏移倍率',
    shadowNormalBias: '法线偏移',
    play: '播放聚光灯动画',
    pause: '暂停聚光灯动画',
    all: '全部光源',
    ambient: '仅环境光',
    directional: '平行光 + 环境光',
    point: '点光 + 环境光',
    spot: '聚光灯 + 环境光',
    hint: '立方体是粗糙电介质，球体是金属，圆柱是光滑电介质。可以分别切换球体投影与地板接影；切换 HDR 与 LDR 全景图可比较球体反射。',
  },
} as const;
const t = computed(() => copy[props.locale]);

const wrapper = ref<HTMLElement | null>(null);
const mode = ref<LightMode>('all');
const intensity = ref(1);
const range = ref(500);
const spotConeDegrees = ref(45);
const attenuation = ref<'range' | 'inverse-square'>('range');
const metallic = ref(1);
const roughness = ref(0.25);
const environment = ref<'hdr' | 'ldr' | 'off'>('hdr');
const shadows = ref(true);
const sphereCastsShadow = ref(true);
const floorReceivesShadow = ref(true);
const shadowStrength = ref(1);
const shadowSoftness = ref(1);
const shadowBiasScale = ref(1);
const shadowNormalBias = ref(0);
const playing = ref(false);
const studioMap = '/lighting-studio.svg';
const hdrStudioMap = '/lighting-studio.hdr';
const environmentMap = computed(() =>
  environment.value === 'hdr'
    ? hdrStudioMap
    : environment.value === 'ldr'
    ? studioMap
    : null,
);

const sceneCenter = { x: 220, y: 180, z: 40 };
const spotLift = 200;
const spotBack = 160;
const lightPresets = [
  { id: 'light-ambient', kind: 'ambient', intensity: 0.7 },
  { id: 'light-key', kind: 'directional', intensity: 1.8 },
  { id: 'light-fill', kind: 'directional', intensity: 0.35 },
  { id: 'light-point', kind: 'point', intensity: 18 },
  { id: 'light-spot', kind: 'spot', intensity: 6 },
] as const;

const sceneNodes: SerializedNode[] = [
  {
    id: 'light-ambient',
    type: 'light3d',
    lightType: 'ambient',
    intensity: 0.7,
    zIndex: -3,
  },
  {
    id: 'light-key',
    type: 'light3d',
    lightType: 'directional',
    direction: [0.45, 0.65, 0.55],
    castShadow: true,
    intensity: 1.8,
    zIndex: -3,
  },
  {
    id: 'light-fill',
    type: 'light3d',
    lightType: 'directional',
    direction: [-0.12, 0.28, -0.88],
    intensity: 0.35,
    zIndex: -3,
  },
  {
    id: 'light-point',
    type: 'light3d',
    lightType: 'point',
    x: 165,
    y: 105,
    z: -160,
    color: '#a8d8ff',
    intensity: 18,
    range: 500,
    castShadow: true,
    zIndex: -3,
  },
  {
    id: 'light-spot',
    type: 'light3d',
    lightType: 'spot',
    x: sceneCenter.x + 90,
    y: sceneCenter.y - spotLift,
    z: sceneCenter.z - spotBack,
    direction: [-90, spotLift, spotBack],
    castShadow: true,
    color: '#ffe6b3',
    intensity: 6,
    range: 500,
    zIndex: -3,
  },
  {
    id: 'floor',
    type: 'mesh3d',
    geometry: { type: 'plane' },
    x: 0,
    y: 0,
    width: 440,
    height: 350,
    z: 100,
    zIndex: -1,
    scale3d: [440, 350, 1],
    rotation3d: [0, Math.PI, 0],
    material3d: {
      baseColor: '#d8dee8',
      ambient: 0.7,
      metallic: 0,
      roughness: 0.95,
      castShadow: false,
      receiveShadow: true,
    },
  },
  {
    id: 'cube-red',
    type: 'mesh3d',
    x: 80,
    y: 140,
    width: 80,
    height: 80,
    z: 40,
    zIndex: 0,
    scale3d: 80,
    rotation3d: [0.35, 0.5, 0],
    material3d: {
      baseColor: '#f25952',
      ambient: 0.5,
      metallic: 0,
      roughness: 0.75,
      environmentMap: hdrStudioMap,
    },
    camera3d: { linked: true, projection: 'perspective', clearColor: false },
  },
  {
    id: 'sphere-white',
    type: 'mesh3d',
    geometry: { type: 'sphere', segments: [24, 16] },
    x: 180,
    y: 140,
    width: 80,
    height: 80,
    z: 40,
    zIndex: 0,
    scale3d: 70,
    rotation3d: [0.35, 0.5, 0],
    material3d: {
      baseColor: '#ebeff2',
      ambient: 0.5,
      metallic: 1,
      roughness: 0.25,
      environmentMap: hdrStudioMap,
      castShadow: true,
    },
  },
  {
    id: 'cylinder-blue',
    type: 'mesh3d',
    geometry: { type: 'cylinder', segments: 24 },
    x: 280,
    y: 140,
    width: 70,
    height: 90,
    z: 40,
    zIndex: 0,
    scale3d: [60, 80, 60],
    rotation3d: [0.35, 0.5, 0],
    material3d: {
      baseColor: '#478cf2',
      ambient: 0.5,
      metallic: 0,
      roughness: 0.2,
      environmentMap: hdrStudioMap,
    },
  },
];

let api: API | undefined;
let canvasElement: HTMLElement | undefined;
let onReady: ((event: CustomEvent<API>) => void) | undefined;
let observer: IntersectionObserver | undefined;
let visible = true;
let disposed = false;
let raf = 0;
let lastFrame = 0;
let elapsed = 0;

function applyLights() {
  if (!api) return;
  for (const preset of lightPresets) {
    const node = api.getNodeById(preset.id);
    if (!node) continue;
    const enabled = mode.value === 'all' || mode.value === preset.kind;
    api.updateNode(
      node,
      {
        intensity:
          preset.kind === 'ambient' &&
          mode.value !== 'ambient' &&
          mode.value !== 'all'
            ? 0.25 * intensity.value
            : enabled
            ? preset.intensity * intensity.value
            : 0,
        ...(preset.kind === 'point' || preset.kind === 'spot'
          ? {
              range: range.value,
              attenuation: attenuation.value,
              referenceDistance: 100,
            }
          : {}),
        ...(preset.kind === 'spot'
          ? { outerConeAngle: (spotConeDegrees.value * Math.PI) / 180 }
          : {}),
        ...(preset.id === 'light-key' ||
        preset.id === 'light-point' ||
        preset.id === 'light-spot'
          ? {
              castShadow: shadows.value,
              shadowStrength: shadowStrength.value,
              shadowSoftness: shadowSoftness.value,
              shadowBiasScale: shadowBiasScale.value,
              shadowNormalBias: shadowNormalBias.value,
            }
          : {}),
      },
      false,
    );
  }
}

function applySphereMaterial() {
  const node = api?.getNodeById('sphere-white');
  if (!node) return;
  api!.updateNode(
    node,
    {
      material3d: {
        baseColor: '#ebeff2',
        ambient: 0.5,
        metallic: metallic.value,
        roughness: roughness.value,
        environmentMap: environmentMap.value,
        castShadow: sphereCastsShadow.value,
      },
    },
    false,
  );
}

function applyFloorMaterial() {
  const node = api?.getNodeById('floor');
  if (!node) return;
  api!.updateNode(
    node,
    {
      material3d: {
        baseColor: '#d8dee8',
        ambient: 0.7,
        metallic: 0,
        roughness: 0.95,
        castShadow: false,
        receiveShadow: floorReceivesShadow.value,
      },
    },
    false,
  );
}

function applyEnvironmentToOtherMeshes() {
  if (!api) return;
  for (const [id, baseColor, metallic, roughness] of [
    ['cube-red', '#f25952', 0, 0.75],
    ['cylinder-blue', '#478cf2', 0, 0.2],
  ] as const) {
    const node = api.getNodeById(id);
    if (node)
      api.updateNode(
        node,
        {
          material3d: {
            baseColor,
            ambient: 0.5,
            metallic,
            roughness,
            environmentMap: environmentMap.value,
          },
        },
        false,
      );
  }
}

function placeSpot(time: number) {
  const spot = api?.getNodeById('light-spot');
  if (!spot) return;
  const px = sceneCenter.x + Math.cos(time * 0.85) * 90;
  const py = sceneCenter.y - spotLift + Math.sin(time * 1.1) * 24;
  const pz = sceneCenter.z - spotBack + Math.sin(time * 0.85) * 40;
  const dx = sceneCenter.x - px,
    dy = sceneCenter.y - py,
    dz = sceneCenter.z - pz;
  const length = Math.hypot(dx, dy, dz) || 1;
  api!.updateNode(
    spot,
    {
      x: px,
      y: py,
      z: pz,
      direction: [dx / length, dy / length, dz / length],
    },
    false,
  );
}

function animate(now: number) {
  if (lastFrame) elapsed += Math.min(now - lastFrame, 50) / 1000;
  lastFrame = now;
  placeSpot(elapsed);
  raf = requestAnimationFrame(animate);
}

function syncAnimation() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  lastFrame = 0;
  if (
    !disposed &&
    api &&
    playing.value &&
    visible &&
    !document.hidden &&
    (mode.value === 'all' || mode.value === 'spot')
  )
    raf = requestAnimationFrame(animate);
}

watch(
  [
    mode,
    intensity,
    range,
    spotConeDegrees,
    attenuation,
    shadows,
    shadowStrength,
    shadowSoftness,
    shadowBiasScale,
    shadowNormalBias,
  ],
  applyLights,
);
watch(
  [metallic, roughness, environment, sphereCastsShadow],
  applySphereMaterial,
);
watch(floorReceivesShadow, applyFloorMaterial);
watch(environment, applyEnvironmentToOtherMeshes);
watch([mode, playing], syncAnimation);

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) return;
  canvasElement = canvas;
  observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncAnimation();
  });
  observer.observe(canvas);
  document.addEventListener('visibilitychange', syncAnimation);
  onReady = (event) => {
    if (api || disposed) return;
    api = event.detail;
    api.setAppState({
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT, Pen.HAND],
      penbarVisible: true,
      taskbarVisible: false,
    });
    api.runAtNextTick(() => {
      if (disposed || !api) return;
      api.updateNodes(sceneNodes);
      api.runAtNextTick(() => {
        if (disposed) return;
        applyLights();
        applySphereMaterial();
        applyFloorMaterial();
        applyEnvironmentToOtherMeshes();
        placeSpot(0);
        syncAnimation();
      });
    });
  };
  canvas.addEventListener(Event.READY, onReady as EventListener);
  await ensureExampleWorld();
});

onUnmounted(() => {
  disposed = true;
  if (raf) cancelAnimationFrame(raf);
  observer?.disconnect();
  document.removeEventListener('visibilitychange', syncAnimation);
  if (canvasElement && onReady)
    canvasElement.removeEventListener(Event.READY, onReady as EventListener);
  api = undefined;
});
</script>

<template>
  <div class="lighting-demo">
    <div class="lighting-controls" role="group" :aria-label="t.controls">
      <label>
        <span>{{ t.mode }}</span>
        <select v-model="mode">
          <option value="all">{{ t.all }}</option>
          <option value="ambient">{{ t.ambient }}</option>
          <option value="directional">{{ t.directional }}</option>
          <option value="point">{{ t.point }}</option>
          <option value="spot">{{ t.spot }}</option>
        </select>
      </label>
      <label>
        <span>{{ t.intensity }}: {{ intensity.toFixed(1) }}</span>
        <input
          v-model.number="intensity"
          type="range"
          min="0"
          max="3"
          step="0.1"
        />
      </label>
      <label>
        <span>{{ t.range }}: {{ range }}</span>
        <input
          v-model.number="range"
          type="range"
          min="150"
          max="800"
          step="10"
        />
      </label>
      <label>
        <span>{{ t.cone }}: {{ spotConeDegrees }}°</span>
        <input
          v-model.number="spotConeDegrees"
          type="range"
          min="25"
          max="120"
          step="5"
        />
      </label>
      <label>
        <span>{{ t.attenuation }}</span>
        <select v-model="attenuation">
          <option value="range">{{ t.rangeFalloff }}</option>
          <option value="inverse-square">{{ t.inverseSquare }}</option>
        </select>
      </label>
      <label>
        <span>{{ t.metallic }}: {{ metallic.toFixed(2) }}</span>
        <input
          v-model.number="metallic"
          type="range"
          min="0"
          max="1"
          step="0.05"
        />
      </label>
      <label>
        <span>{{ t.roughness }}: {{ roughness.toFixed(2) }}</span>
        <input
          v-model.number="roughness"
          type="range"
          min="0.04"
          max="1"
          step="0.01"
        />
      </label>
      <label>
        <span>{{ t.environment }}</span>
        <select v-model="environment">
          <option value="hdr">{{ t.hdr }}</option>
          <option value="ldr">{{ t.ldr }}</option>
          <option value="off">{{ t.off }}</option>
        </select>
      </label>
      <label class="lighting-checkbox">
        <input v-model="shadows" type="checkbox" />
        <span>{{ t.shadows }}</span>
      </label>
      <label class="lighting-checkbox">
        <input v-model="sphereCastsShadow" type="checkbox" />
        <span>{{ t.sphereCastsShadow }}</span>
      </label>
      <label class="lighting-checkbox">
        <input v-model="floorReceivesShadow" type="checkbox" />
        <span>{{ t.floorReceivesShadow }}</span>
      </label>
      <label>
        <span>{{ t.shadowStrength }}: {{ shadowStrength.toFixed(2) }}</span>
        <input
          v-model.number="shadowStrength"
          type="range"
          min="0"
          max="1"
          step="0.05"
        />
      </label>
      <label>
        <span>{{ t.shadowSoftness }}: {{ shadowSoftness.toFixed(1) }}</span>
        <input
          v-model.number="shadowSoftness"
          type="range"
          min="0"
          max="4"
          step="0.25"
        />
      </label>
      <label>
        <span>{{ t.shadowBiasScale }}: {{ shadowBiasScale.toFixed(2) }}</span>
        <input
          v-model.number="shadowBiasScale"
          type="range"
          min="0"
          max="4"
          step="0.1"
        />
      </label>
      <label>
        <span>{{ t.shadowNormalBias }}: {{ shadowNormalBias.toFixed(1) }}</span>
        <input
          v-model.number="shadowNormalBias"
          type="range"
          min="0"
          max="10"
          step="0.25"
        />
      </label>
      <button type="button" :aria-pressed="playing" @click="playing = !playing">
        {{ playing ? t.pause : t.play }}
      </button>
    </div>
    <p>{{ t.hint }}</p>
    <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 360px" />
  </div>
</template>

<style scoped>
.lighting-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 12px;
  margin-bottom: 12px;
}
.lighting-controls label {
  display: grid;
  gap: 4px;
  min-width: 120px;
  font-size: 13px;
}
.lighting-controls select,
.lighting-controls button {
  padding: 6px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}
.lighting-controls input[type='range'] {
  width: 130px;
}
.lighting-controls .lighting-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding-bottom: 7px;
}
.lighting-demo p {
  margin: 4px 0 12px;
  font-size: 13px;
}
</style>
