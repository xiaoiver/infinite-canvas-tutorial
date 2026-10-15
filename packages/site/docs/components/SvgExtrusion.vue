<script setup lang="ts">
import {
  Pen,
  GPUResource,
  svgElementsToExtrudedNodes,
  svgElementsToSerializedNodes,
  type API,
  type SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { onMounted, onUnmounted, ref } from 'vue';
import { Event as CanvasEvent } from '@infinite-canvas-tutorial/webcomponents';
import { ensureExampleWorld } from '../lib/ensure-example-world';

const sample = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 240">
  <path id="ring" d="M40 45 H180 V185 H40 Z M85 90 H135 V140 H85 Z" fill="#3b82f6" fill-rule="evenodd"/>
  <polygon id="triangle" points="235,170 310,45 385,170" fill="#f97316"/>
  <path id="open-line" d="M240 195 H390" fill="none" stroke="#64748b" stroke-width="4"/>
</svg>`;

const wrapper = ref<HTMLElement | null>(null);
const depth = ref(35);
const show3D = ref(true);
const status = ref('Loading canvas…');
let svgSource = sample;
let api: API | undefined;
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
      node.type === 'path' && node.extrude3d
        ? {
            ...node,
            extrude3d: {
              depth: depth.value,
              rotation: [0.4, -0.35, 0],
            },
          }
        : node,
    );
    await api.edit((editor) => editor.replaceDocument(nodes, 'remote'), {
      capture: 'NEVER',
    });
    const count = nodes.filter(
      (node) => node.type === 'path' && node.extrude3d,
    ).length;
    status.value = show3D.value
      ? `${count} closed paths extruded; unsupported shapes stay in 2D.`
      : 'All imported shapes are in 2D.';
  } catch (error) {
    status.value = error instanceof Error ? error.message : 'SVG import failed';
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
        Extrude closed paths
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
        Upload SVG
        <input type="file" accept=".svg,image/svg+xml" @change="upload" />
      </label>
      <button type="button" @click="reset">Reset sample</button>
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
