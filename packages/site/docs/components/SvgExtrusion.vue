<script setup lang="ts">
import {
  Pen,
  GPUResource,
  ExportFormat,
  svgElementsToExtrudedNodes,
  svgElementsToSerializedNodes,
  type API,
  type SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { onMounted, onUnmounted, ref } from 'vue';
import { Event as CanvasEvent } from '@infinite-canvas-tutorial/webcomponents';
import { ensureExampleWorld } from '../lib/ensure-example-world';

const sample = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 310">
  <path id="ring" d="M40 30 H170 V160 H40 Z M80 70 H130 V120 H80 Z" fill="#3b82f6" fill-rule="evenodd"/>
  <polygon id="triangle" points="230,155 295,30 360,155" fill="#f97316"/>
  <rect id="box" x="390" y="40" width="65" height="105" transform="rotate(12 422.5 92.5)" fill="#22c55e"/>
  <circle id="circle" cx="80" cy="230" r="28" fill="#a855f7"/>
  <ellipse id="ellipse" cx="185" cy="230" rx="42" ry="26" fill="#ef4444"/>
  <rect id="rounded" x="270" y="202" width="170" height="58" rx="18" ry="10" fill="#06b6d4"/>
  <path id="open-line" d="M40 290 H440" fill="none" stroke="#64748b" stroke-width="4"/>
</svg>`;

const wrapper = ref<HTMLElement | null>(null);
const depth = ref(35);
const bevelSize = ref(2);
const bevelSegments = ref(4);
const useSideColor = ref(false);
const sideColor = ref('#facc15');
const show3D = ref(true);
const status = ref('Loading canvas…');
let svgSource = sample;
let api: API | undefined;
let importedNodes: SerializedNode[] = [];
let onReady: ((event: CustomEvent<API>) => void) | undefined;

function parseSVG() {
  const document = new DOMParser().parseFromString(svgSource, 'image/svg+xml');
  if (
    document.documentElement.localName !== 'svg' ||
    document.querySelector('parsererror')
  )
    throw new Error('Invalid SVG file');
  return Array.from(document.documentElement.children) as SVGElement[];
}

async function render() {
  if (!api) return;
  try {
    const children = parseSVG();
    const imported = show3D.value
      ? svgElementsToExtrudedNodes(children, depth.value)
      : svgElementsToSerializedNodes(children);
    const nodes: SerializedNode[] = imported.map((node) =>
      (node.type === 'path' || node.type === 'rect') && node.extrude3d
        ? {
            ...node,
            extrude3d: {
              depth: depth.value,
              bevelSize: bevelSize.value,
              bevelSegments: bevelSegments.value,
              rotation: [0.4, -0.35, 0],
              ...(useSideColor.value ? { sideColor: sideColor.value } : {}),
            },
          }
        : node,
    );
    await api.edit((editor) => editor.replaceDocument(nodes, 'remote'), {
      capture: 'NEVER',
    });
    importedNodes = nodes;
    const count = nodes.filter(
      (node) =>
        (node.type === 'path' || node.type === 'rect') && node.extrude3d,
    ).length;
    status.value = show3D.value
      ? `${count} closed shapes extruded; unsupported shapes stay in 2D.`
      : 'All imported shapes are in 2D.';
  } catch (error) {
    status.value = error instanceof Error ? error.message : 'SVG import failed';
  }
}

function downloadGlb() {
  if (!api) return;
  try {
    api.export({ format: ExportFormat.GLB, nodes: importedNodes });
    status.value = 'Downloaded extruded shapes as GLB.';
  } catch (error) {
    status.value = error instanceof Error ? error.message : 'GLB export failed';
  }
}

async function upload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  svgSource = await file.text();
  await render();
}

function reset() {
  svgSource = sample;
  show3D.value = true;
  depth.value = 35;
  bevelSize.value = 2;
  bevelSegments.value = 4;
  useSideColor.value = false;
  sideColor.value = '#facc15';
  void render();
}

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) return;
  const initialize = (readyApi: API) => {
    if (api === readyApi) return;
    api = readyApi;
    api.setAppState({
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT, Pen.HAND],
      taskbarVisible: false,
    });
    api.runAtNextTick(() => void render());
  };
  onReady = (event) => initialize(event.detail);
  canvas.addEventListener(CanvasEvent.READY, onReady as EventListener);
  const existing = (canvas as HTMLElement & { apiProvider?: { value?: API } })
    .apiProvider?.value;
  if (existing?.getCanvas().has(GPUResource)) initialize(existing);
  await ensureExampleWorld();
});

onUnmounted(() => {
  if (wrapper.value && onReady)
    wrapper.value.removeEventListener(
      CanvasEvent.READY,
      onReady as EventListener,
    );
  api = undefined;
});
</script>

<template>
  <div class="svg-extrusion-demo">
    <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 360px" />
    <div class="svg-extrusion-controls">
      <label>
        <input v-model="show3D" type="checkbox" @change="render" />
        Extrude filled shapes
      </label>
      <label>
        Depth {{ depth }}
        <input
          v-model.number="depth"
          type="range"
          min="8"
          max="90"
          @change="render"
        />
      </label>
      <label>
        Bevel {{ bevelSize }}
        <input
          v-model.number="bevelSize"
          type="range"
          min="0"
          max="3"
          step="1"
          @change="render"
        />
      </label>
      <label>
        Bevel profile
        <select
          v-model.number="bevelSegments"
          :disabled="!bevelSize"
          @change="render"
        >
          <option :value="1">Straight</option>
          <option :value="4">Rounded</option>
          <option :value="8">Smooth rounded</option>
        </select>
      </label>
      <label>
        <input v-model="useSideColor" type="checkbox" @change="render" />
        Custom side color
      </label>
      <label v-if="useSideColor">
        Side color
        <input v-model="sideColor" type="color" @change="render" />
      </label>
      <label>
        Upload SVG
        <input type="file" accept=".svg,image/svg+xml" @change="upload" />
      </label>
      <button type="button" @click="reset">Reset sample</button>
      <button type="button" :disabled="!show3D" @click="downloadGlb">
        Download GLB
      </button>
    </div>
    <p role="status">{{ status }}</p>
  </div>
</template>

<style scoped>
.svg-extrusion-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}
.svg-extrusion-controls label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>
