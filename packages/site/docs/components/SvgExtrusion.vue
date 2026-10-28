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

const sample = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 310">
  <path id="ring" d="M40 30 H170 V160 H40 Z M80 70 H130 V120 H80 Z" fill="#3b82f6" fill-rule="evenodd"/>
  <polygon id="triangle" points="230,155 295,30 360,155" fill="#f97316"/>
  <polyline id="closed-polyline" points="225,225 245,185 265,225 225,225" fill="#eab308"/>
  <rect id="box" x="390" y="40" width="65" height="105" transform="rotate(12 422.5 92.5)" fill="#22c55e"/>
  <circle id="circle" cx="80" cy="230" r="28" fill="#a855f7"/>
  <ellipse id="ellipse" cx="185" cy="230" rx="42" ry="26" fill="#ef4444"/>
  <rect id="rounded" x="270" y="202" width="170" height="58" rx="18" ry="10" fill="#06b6d4"/>
  <path id="open-line" d="M40 290 H440" fill="none" stroke="#64748b" stroke-width="4"/>
</svg>`;

const transformedSample = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="310" viewBox="0 0 240 155">',
  '<g transform="skewX(18)" fill="#3b82f6">',
  '<path d="M20 20 H85 V85 H20 Z M40 40 H65 V65 H40 Z" fill-rule="evenodd"/>',
  '</g>',
  '<rect x="125" y="28" width="62" height="55" rx="12" ry="6" transform="matrix(1 0.2 0 1 0 0)" fill="#22c55e"/>',
  '<ellipse cx="125" cy="120" rx="32" ry="18" fill="#ef4444"/>',
  '</svg>',
].join('');

const sliceSample = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="310" viewBox="0 0 240 240" preserveAspectRatio="xMidYMid slice">',
  '<path d="M20 20 H110 V135 H20 Z M45 55 H85 V100 H45 Z" fill-rule="evenodd" fill="#3b82f6"/>',
  '<path d="M125 10 H220 V150 H195 V35 H150 V150 H125 Z" fill="#f97316"/>',
  '<ellipse cx="190" cy="195" rx="35" ry="30" fill="#a855f7"/>',
  '</svg>',
].join('');

const useSample = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 310">',
  '<use id="first-star" href="#star" x="40" y="55" fill="#3b82f6"/>',
  '<rect id="between-stars" x="175" y="85" width="70" height="70" rx="12" fill="#22c55e"/>',
  '<defs><path id="star" d="M40 0 L50 28 L80 28 L56 47 L65 76 L40 58 L15 76 L24 47 L0 28 L30 28 Z"/></defs>',
  '<use id="second-star" href="#star" x="305" y="55" transform="rotate(18 345 93)" fill="#f97316"/>',
  '</svg>',
].join('');

const symbolSample = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 310">',
  '<defs><symbol id="badge" viewBox="0 0 100 60" width="180" height="180">',
  '<path id="badge-shape" d="M0 0 H100 V60 H0 Z M25 15 H75 V45 H25 Z" fill-rule="evenodd"/>',
  '</symbol></defs>',
  '<use id="badge-one" href="#badge" x="35" y="45" fill="#3b82f6"/>',
  '<use id="badge-two" href="#badge" x="265" y="45" width="160" height="160" fill="#f97316"/>',
  '</svg>',
].join('');

const nestedViewportSample = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 310">',
  '<g fill="#3b82f6"><svg id="nested-card" x="20" y="35" width="180" height="180"',
  ' viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">',
  '<path id="card-shape" d="M0 0 H120 V100 H0 Z M30 25 H70 V75 H30 Z" fill-rule="evenodd"/>',
  '</svg></g>',
  '<use id="nested-copy" href="#nested-card" x="240" width="180" height="180" fill="#f97316"/>',
  '</svg>',
].join('');

const paintStyleSample = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 310" style="color: #3b82f6">',
  '<defs><path id="paint-tile" d="M0 0 H90 V90 H0 Z M25 25 H65 V65 H25 Z" fill="currentColor" fill-rule="evenodd"/></defs>',
  '<use id="blue-tile" href="#paint-tile" x="35" y="60"/>',
  '<use id="orange-tile" href="#paint-tile" x="185" y="60" style="color: #f97316"/>',
  '<path id="styled-fill" d="M340 60 H430 V150 H340 Z" fill="none" style="fill: #22c55e"/>',
  '<path id="styled-stroke" d="M55 210 H155 V275 H55 Z" fill="#a855f7" style="stroke: #1e293b; stroke-width: 5"/>',
  '</svg>',
].join('');

const clippingSample = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 310">',
  '<defs>',
  '<path id="clip-tile" d="M-15 -15 H175 V175 H-15 Z"/>',
  '<clipPath id="ring-window"><path d="M0 0 H160 V160 H0 Z M45 45 H115 V115 H45 Z" clip-rule="evenodd"/></clipPath>',
  '<clipPath id="two-windows" clipPathUnits="objectBoundingBox"><rect x="0.1" y="0" width="0.28" height="1"/><circle cx="0.75" cy="0.5" r="0.25"/></clipPath>',
  '</defs>',
  '<use id="blue-cut" href="#clip-tile" x="30" y="30" fill="#3b82f6" clip-path="url(#ring-window)"/>',
  '<use id="orange-cut" href="#clip-tile" x="280" y="30" fill="#f97316" style="clip-path: url(#ring-window)"/>',
  '<rect id="windows" x="150" y="220" width="160" height="70" fill="#22c55e" clip-path="url(#two-windows)"/>',
  '</svg>',
].join('');

const groupedClippingSample = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 310">',
  '<defs><rect id="narrow-window" width="0.25" height="1"/>',
  '<clipPath id="group-windows" clipPathUnits="objectBoundingBox">',
  '<use href="#narrow-window" x="0.1"/><use href="#narrow-window" x="0.65"/>',
  '</clipPath></defs>',
  '<g transform="translate(20 60)" clip-path="url(#group-windows)">',
  '<rect id="group-left" x="30" y="20" width="140" height="140" fill="#3b82f6"/>',
  '<path id="group-right" d="M210 20 H350 V160 H210 Z M250 60 H310 V120 H250 Z"',
  ' fill="#f97316" fill-rule="evenodd"/>',
  '</g></svg>',
].join('');

const strokeSample = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 310">',
  '<g fill="none" stroke="#2563eb" stroke-width="16">',
  '<path id="round-line" d="M40 70 L130 70 L130 145" stroke-linecap="round" stroke-linejoin="round"/>',
  '<path id="square-line" d="M185 70 L275 70 L275 145" stroke-linecap="square" stroke-linejoin="bevel"/>',
  '</g>',
  '<path id="filled-outline" d="M335 60 H420 V145 H335 Z" fill="#f97316" stroke="#1e293b" stroke-width="12"/>',
  '<g transform="scale(2 0.5)"><path id="non-scaling-3d" d="M45 350 H195" fill="none" stroke="#be185d" stroke-width="10" vector-effect="non-scaling-stroke"/></g>',
  '<path id="dashed-3d" d="M45 230 H430" fill="none" stroke="#64748b" stroke-width="12" stroke-dasharray="18 12" stroke-dashoffset="6" stroke-linecap="round"/>',
  '<path id="dotted-3d" d="M45 275 H430" fill="none" stroke="#0f766e" stroke-width="12" stroke-dasharray="0 26" stroke-linecap="round"/>',
  '</svg>',
].join('');

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
  return document.documentElement as unknown as SVGSVGElement;
}

async function render() {
  if (!api) return;
  try {
    const svg = parseSVG();
    const imported = show3D.value
      ? svgElementsToExtrudedNodes(svg, depth.value)
      : svgElementsToSerializedNodes(Array.from(svg.children) as SVGElement[]);
    const nodes: SerializedNode[] = imported.map((node) => {
      if (!show3D.value) {
        const { extrude3d: _extrude3d, ...flat } = node as SerializedNode & {
          extrude3d?: number;
        };
        return flat as SerializedNode;
      }
      return (node.type === 'path' || node.type === 'rect') && node.extrude3d
        ? {
            ...node,
            extrude3d: {
              depth: typeof node.extrude3d === 'object'
                ? node.extrude3d.depth ?? depth.value
                : depth.value,
              ...(typeof node.extrude3d === 'object' ? { z: node.extrude3d.z } : {}),
              bevelSize: bevelSize.value,
              bevelSegments: bevelSegments.value,
              rotation: [0.4, -0.35, 0],
              ...(useSideColor.value ? { sideColor: sideColor.value } : {}),
            },
          }
        : node;
    });
    await api.edit((editor) => editor.replaceDocument(nodes, 'remote'), {
      capture: 'NEVER',
    });
    importedNodes = nodes;
    const count = nodes.filter(
      (node) =>
        (node.type === 'path' || node.type === 'rect') && node.extrude3d,
    ).length;
    status.value = show3D.value
      ? `${count} filled regions and stroke outlines extruded; unsupported shapes stay in 2D.`
      : 'All imported shapes are in 2D.';
  } catch (error) {
    status.value = error instanceof Error ? error.message : 'SVG import failed';
  }
}

async function downloadGlb() {
  if (!api) return;
  try {
    await api.exportGlb({ nodes: importedNodes });
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

function loadTransformedSample() {
  svgSource = transformedSample;
  show3D.value = true;
  void render();
}

function loadSliceSample() {
  svgSource = sliceSample;
  show3D.value = true;
  void render();
}

function loadUseSample() {
  svgSource = useSample;
  show3D.value = true;
  void render();
}

function loadSymbolSample() {
  svgSource = symbolSample;
  show3D.value = true;
  void render();
}

function loadNestedViewportSample() {
  svgSource = nestedViewportSample;
  show3D.value = true;
  void render();
}

function loadPaintStyleSample() {
  svgSource = paintStyleSample;
  show3D.value = true;
  void render();
}

function loadClippingSample() {
  svgSource = clippingSample;
  show3D.value = true;
  void render();
}

function loadGroupedClippingSample() {
  svgSource = groupedClippingSample;
  show3D.value = true;
  void render();
}

function loadStrokeSample() {
  svgSource = strokeSample;
  show3D.value = true;
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
        Extrude supported shapes
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
      <button type="button" @click="loadTransformedSample">
        ViewBox + shear sample
      </button>
      <button type="button" @click="loadSliceSample">
        Slice clipping sample
      </button>
      <button type="button" @click="loadUseSample">Repeated use sample</button>
      <button type="button" @click="loadSymbolSample">
        Symbol viewport sample
      </button>
      <button type="button" @click="loadNestedViewportSample">
        Nested SVG viewport sample
      </button>
      <button type="button" @click="loadPaintStyleSample">
        Paint style + currentColor sample
      </button>
      <button type="button" @click="loadClippingSample">
        Clip paths + repeated use sample
      </button>
      <button type="button" @click="loadGroupedClippingSample">
        Group bounds + clip use sample
      </button>
      <button type="button" @click="loadStrokeSample">
        Stroke caps + joins sample
      </button>
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
