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
const editPlaneZ = ref(0);
const boxDepth = ref(48);
const previewPoints = ref('');
const previewBounds = ref({ left: 0, top: 0, width: 0, height: 0 });
const tool = ref<Pen.SELECT | Pen.HAND | Pen.DRAW_BOX_3D>(Pen.SELECT);
let drawStart:
  | {
      pointerId: number;
      world: [number, number, number];
      viewport: [number, number];
    }
  | undefined;
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

function setTool(next: Pen.SELECT | Pen.HAND | Pen.DRAW_BOX_3D) {
  drawStart = undefined;
  previewPoints.value = '';
  tool.value = next;
  api?.setAppState({ penbarSelected: next });
}

function pointerViewport(event: PointerEvent): [number, number] | null {
  if (!api) return null;
  const point = api.client2Viewport({ x: event.clientX, y: event.clientY });
  return [point.x, point.y];
}

function syncPreviewBounds() {
  if (!api || !wrapper.value) return;
  const canvas = api.getCanvasElement().getBoundingClientRect();
  const host = wrapper.value.getBoundingClientRect();
  previewBounds.value = {
    left: canvas.left - host.left,
    top: canvas.top - host.top,
    width: canvas.width,
    height: canvas.height,
  };
}

function onPointerDown(event: PointerEvent) {
  if (
    tool.value !== Pen.DRAW_BOX_3D ||
    !api ||
    event.button !== 0 ||
    !event.isPrimary
  )
    return;
  const viewport = pointerViewport(event);
  if (!viewport) return;
  const world = api.viewport2WorldOnPlane(
    { x: viewport[0], y: viewport[1] },
    editPlaneZ.value,
  );
  if (!world) return;
  syncPreviewBounds();
  drawStart = { pointerId: event.pointerId, world, viewport };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  event.preventDefault();
}

function drawGeometry(event: PointerEvent) {
  if (!api || !drawStart || event.pointerId !== drawStart.pointerId)
    return null;
  syncPreviewBounds();
  const viewport = pointerViewport(event);
  if (!viewport) return null;
  const end = api.viewport2WorldOnPlane(
    { x: viewport[0], y: viewport[1] },
    editPlaneZ.value,
  );
  if (!end) return null;
  const [startX, startY, z] = drawStart.world;
  const x = Math.min(startX, end[0]);
  const y = Math.min(startY, end[1]);
  const width = Math.abs(end[0] - startX);
  const height = Math.abs(end[1] - startY);
  const corners: [number, number, number][] = [
    [x, y, z],
    [x + width, y, z],
    [x + width, y + height, z],
    [x, y + height, z],
  ];
  const projected = corners.map((point) => api!.world3D2Viewport(point));
  previewPoints.value = projected.every(Boolean)
    ? projected.map((point) => point!.join(',')).join(' ')
    : '';
  return { x, y, width, height, viewport };
}

function onPointerMove(event: PointerEvent) {
  if (tool.value === Pen.DRAW_BOX_3D) drawGeometry(event);
}

function onPointerUp(event: PointerEvent) {
  if (!drawStart || event.pointerId !== drawStart.pointerId) return;
  const geometry = drawGeometry(event);
  const start = drawStart;
  drawStart = undefined;
  previewPoints.value = '';
  if (!geometry || !api || tool.value !== Pen.DRAW_BOX_3D) return;
  const { x, y, width, height, viewport } = geometry;
  if (
    Math.hypot(
      viewport[0] - start.viewport[0],
      viewport[1] - start.viewport[1],
    ) < 8 ||
    width < 2 ||
    height < 2
  )
    return;
  const depth = boxDepth.value;
  if (!Number.isFinite(depth) || depth <= 0) return;
  const node: SerializedNode = {
    id: crypto.randomUUID(),
    name: 'Drawn box',
    type: 'mesh3d',
    geometry: { type: 'cube' },
    x,
    y,
    width,
    height,
    z: start.world[2] + depth / 2,
    scale3d: [width, height, depth],
    material3d: { baseColor: '#43a98a', roughness: 0.8, castShadow: true },
  };
  const editor = api;
  setTool(Pen.SELECT);
  editor.runAtNextTick(() => {
    editor.updateNode(node);
    editor.selectNodes([node]);
    editor.record();
  });
}

function onPointerCancel(event: PointerEvent) {
  if (drawStart?.pointerId === event.pointerId) {
    drawStart = undefined;
    previewPoints.value = '';
  }
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
      penbarAll: [Pen.SELECT, Pen.HAND, Pen.DRAW_BOX_3D],
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
      <button
        :aria-pressed="tool === Pen.DRAW_BOX_3D"
        @click="setTool(Pen.DRAW_BOX_3D)"
      >
        {{ props.locale === 'zh' ? '绘制盒子' : 'Draw box' }}
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
    <label
      >{{ props.locale === 'zh' ? '编辑平面 Z' : 'Edit plane Z' }}
      <input v-model.number="editPlaneZ" type="number" step="10" />
    </label>
    <label
      >{{ props.locale === 'zh' ? '盒子深度' : 'Box depth' }}
      <input v-model.number="boxDepth" type="number" min="1" step="10" />
    </label>
  </div>
  <p class="isometric-hint">
    {{
      props.locale === 'zh'
        ? '选择“绘制盒子”，在指定 Z 平面上拖出底面；可调整深度。选择工具可框选，Shift 可从地板开始框选。平移工具拖动视图，Shift + 拖动转动视角；滚轮缩放，双指平移或缩放。'
        : 'Choose Draw box to drag a base on the selected Z plane; adjust its depth above. Select can marquee meshes, and Shift starts a marquee over the ground. Pan / orbit moves the view; Shift + drag orbits. Wheel zooms, and two fingers pan or pinch to zoom.'
    }}
  </p>
  <div class="isometric-canvas">
    <ic-spectrum-canvas
      ref="wrapper"
      style="width: 100%; height: 400px"
      :class="{ 'drawing-box': tool === Pen.DRAW_BOX_3D }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
    />
    <svg
      class="isometric-preview"
      aria-hidden="true"
      :style="{
        left: `${previewBounds.left}px`,
        top: `${previewBounds.top}px`,
        width: `${previewBounds.width}px`,
        height: `${previewBounds.height}px`,
      }"
    >
      <polygon v-if="previewPoints" :points="previewPoints" />
    </svg>
  </div>
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
.isometric-canvas {
  position: relative;
}
.isometric-canvas ic-spectrum-canvas {
  display: block;
}
.drawing-box {
  cursor: crosshair;
  touch-action: none;
}
.isometric-preview {
  position: absolute;
  pointer-events: none;
}
.isometric-preview polygon {
  fill: #43a98a66;
  stroke: #238b6d;
  stroke-width: 2;
}
</style>
