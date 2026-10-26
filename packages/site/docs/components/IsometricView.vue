<script setup lang="ts">
import {
  Camera3D,
  Mesh3DNode,
  Pen,
  Transform3D,
  canExtrudePath,
  collectPathControlHandles,
  normalizePathCommands,
  setPathHandlePoint,
  svgElementsToExtrudedNodes,
  toPathData,
  type API,
  type AxonometricPreset,
  type PathCommand,
  type PathControlHandleMeta,
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
const ringTilted = ref(false);
const pathHandles = ref<
  { x: number; y: number; meta: PathControlHandleMeta; control: boolean }[]
>([]);
const previewBounds = ref({ left: 0, top: 0, width: 0, height: 0 });
const showCallouts = ref(false);
const steppedTones = ref(false);
const showOutlines = ref(false);
const showRimLight = ref(false);
const sweepLight = ref(false);
const autoOrbit = ref(false);
type Callout = {
  id: string;
  title: string;
  anchorX: number;
  anchorY: number;
  labelX: number;
  labelY: number;
};
const callouts = ref<Callout[]>([]);
type Tool =
  | Pen.SELECT
  | Pen.HAND
  | Pen.ORBIT_3D
  | Pen.DRAW_BOX_3D
  | 'edit-path-3d';
const tool = ref<Tool>(Pen.SELECT);
let drawStart:
  | {
      pointerId: number;
      world: [number, number, number];
      viewport: [number, number];
    }
  | undefined;
let api: API | undefined;
let onReady: ((event: CustomEvent<API>) => void) | undefined;
let pathEdit:
  | {
      pointerId: number;
      meta: PathControlHandleMeta;
      commands: PathCommand[];
      originalD: string;
      startViewport: [number, number];
      moved: boolean;
      queued: boolean;
      finished: boolean;
      cancelled: boolean;
    }
  | undefined;
let anchorFrame = 0;
let animationFrame = 0;
let visibilityObserver: IntersectionObserver | undefined;
let previewInView = true;
let lightElapsed = 0;
let animationLastFrame = 0;
let orbitPose:
  | {
      center: [number, number, number];
      distance: number;
      elevation: number;
      azimuth: number;
      orthographicHeight: number;
      clearColor: boolean;
    }
  | undefined;

function applyCamera() {
  api?.setCamera3D({
    preset: preset.value,
    center: [245, 180, 15],
    distance: distance.value,
    orthographicHeight: height.value,
    clearColor: false,
  });
}
watch([preset, height, distance], () => {
  stopAutoOrbit();
  applyCamera();
});

function setTool(next: Tool) {
  stopAutoOrbit();
  if (pathEdit) finishPathEdit(true);
  drawStart = undefined;
  previewPoints.value = '';
  tool.value = next;
  pathHandles.value = [];
  api?.setAppState({
    penbarSelected: next === 'edit-path-3d' ? Pen.HAND : next,
  });
  if (next === 'edit-path-3d') refreshPathHandles();
}

function ringNode() {
  const node = api?.getNodeById('iso-ring');
  return node?.type === 'path' && node.extrude3d ? node : undefined;
}

function toggleRingTilt() {
  const editor = api;
  if (!editor) return;
  ringTilted.value = !ringTilted.value;
  const tilted = ringTilted.value;
  editor.runAtNextTick(() => {
    const node = editor.getNodeById('iso-ring');
    if (node?.type !== 'path') return;
    editor.updateNode(node, {
      extrude3d: {
        ...(typeof node.extrude3d === 'object' ? node.extrude3d : {}),
        depth: 50,
        rotation: tilted ? [0.35, -0.25, 0.2] : [0, 0, 0],
      },
    });
    editor.record();
  });
}

function toggleSteppedTones() {
  const editor = api;
  if (!editor) return;
  const toneSteps = steppedTones.value ? 0 : 4;
  editor.runAtNextTick(() => {
    const cube = editor.getNodeById('iso-cube');
    const ring = ringNode();
    if (cube?.type !== 'mesh3d' || !ring) return;
    editor.updateNode(cube, {
      material3d: { ...cube.material3d, toneSteps },
    });
    editor.updateNode(ring, {
      extrude3d: {
        ...(typeof ring.extrude3d === 'object'
          ? ring.extrude3d
          : { depth: 50 }),
        toneSteps,
      },
    });
    editor.record();
  });
}

function toggleOutlines() {
  const editor = api;
  if (!editor) return;
  const outlineWidth = showOutlines.value ? 0 : 2;
  editor.runAtNextTick(() => {
    const cube = editor.getNodeById('iso-cube');
    const ring = ringNode();
    if (cube?.type !== 'mesh3d' || !ring) return;
    editor.updateNode(cube, {
      material3d: {
        ...cube.material3d,
        outlineWidth,
        outlineColor: '#1e3264',
      },
    });
    editor.updateNode(ring, {
      extrude3d: {
        ...(typeof ring.extrude3d === 'object'
          ? ring.extrude3d
          : { depth: 50 }),
        outlineWidth,
        outlineColor: '#643819',
      },
    });
    editor.record();
  });
}

function toggleRimLight() {
  const editor = api;
  if (!editor) return;
  const rimLightStrength = showRimLight.value ? 0 : 0.9;
  editor.runAtNextTick(() => {
    const cube = editor.getNodeById('iso-cube');
    const ring = ringNode();
    if (cube?.type !== 'mesh3d' || !ring) return;
    editor.updateNode(cube, {
      material3d: {
        ...cube.material3d,
        rimLightStrength,
        rimLightColor: '#9ad9ff',
      },
    });
    editor.updateNode(ring, {
      extrude3d: {
        ...(typeof ring.extrude3d === 'object'
          ? ring.extrude3d
          : { depth: 50 }),
        rimLightStrength,
        rimLightColor: '#ffd18a',
      },
    });
    editor.record();
  });
}

function placeSweepLight(time: number) {
  const editor = api;
  const light = editor?.getNodeById('iso-sweep-light');
  if (!editor || light?.type !== 'light3d') return;
  const x = 245 + Math.cos(time * 0.8) * 140;
  const y = 180 + Math.sin(time * 0.8) * 105;
  const z = 170;
  const delta: [number, number, number] = [245 - x, 180 - y, -z];
  const length = Math.hypot(...delta);
  editor.updateNode(
    light,
    {
      x,
      y,
      z,
      direction: delta.map((value) => value / length) as [
        number,
        number,
        number,
      ],
      intensity: sweepLight.value ? 8 : 0,
      castShadow: sweepLight.value,
    },
    false,
  );
}

function placeOrbit() {
  if (!api || !orbitPose) return;
  const {
    center,
    distance,
    elevation,
    azimuth,
    orthographicHeight,
    clearColor,
  } = orbitPose;
  const horizontal = distance * Math.cos(elevation);
  api.setCamera3D({
    projection: 'orthographic',
    center,
    eye: [
      center[0] + horizontal * Math.cos(azimuth),
      center[1] + horizontal * Math.sin(azimuth),
      center[2] + distance * Math.sin(elevation),
    ],
    up: [0, 0, 1],
    orthographicHeight,
    clearColor,
  });
}

function animateScene(now: number) {
  if ((!sweepLight.value && !autoOrbit.value) || !previewActive()) {
    animationFrame = 0;
    return;
  }
  if (animationLastFrame && now - animationLastFrame < 33) {
    animationFrame = requestAnimationFrame(animateScene);
    return;
  }
  const delta = animationLastFrame
    ? Math.min(now - animationLastFrame, 50) / 1000
    : 0;
  animationLastFrame = now;
  if (sweepLight.value) {
    lightElapsed += delta;
    placeSweepLight(lightElapsed);
  }
  if (autoOrbit.value && orbitPose) {
    orbitPose.azimuth += delta * 0.35;
    placeOrbit();
  }
  animationFrame = requestAnimationFrame(animateScene);
}

function syncAnimation() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  animationLastFrame = 0;
  if ((sweepLight.value || autoOrbit.value) && previewActive())
    animationFrame = requestAnimationFrame(animateScene);
}

function previewActive() {
  return !!api && previewInView && !document.hidden;
}

function syncPreviewActivity() {
  if (anchorFrame) cancelAnimationFrame(anchorFrame);
  anchorFrame = 0;
  if (previewActive()) anchorFrame = requestAnimationFrame(animatePathHandles);
  syncAnimation();
}

function toggleSweepLight() {
  sweepLight.value = !sweepLight.value;
  placeSweepLight(lightElapsed);
  syncAnimation();
}

function stopAutoOrbit() {
  if (!autoOrbit.value) return;
  autoOrbit.value = false;
  orbitPose = undefined;
  syncAnimation();
}

function toggleAutoOrbit() {
  if (autoOrbit.value) {
    stopAutoOrbit();
    return;
  }
  const editor = api;
  if (!editor) return;
  const canvas = editor.getCanvas();
  if (!canvas.has(Camera3D)) return;
  const camera = canvas.read(Camera3D);
  const center = [...camera.center] as [number, number, number];
  const offset = camera.eye.map((value, axis) => value - center[axis]);
  const distance = Math.hypot(...offset);
  if (!Number.isFinite(distance) || distance <= 0) return;
  orbitPose = {
    center,
    distance,
    elevation: Math.atan2(offset[2], Math.hypot(offset[0], offset[1])),
    azimuth: Math.atan2(offset[1], offset[0]),
    orthographicHeight: camera.orthographicHeight,
    clearColor: camera.clearColor,
  };
  autoOrbit.value = true;
  syncAnimation();
}

function onVisibilityChange() {
  syncPreviewActivity();
}

function refreshPathHandles() {
  if (!api || tool.value !== 'edit-path-3d') return;
  syncPreviewBounds();
  const node = ringNode();
  const commands =
    pathEdit?.commands ?? (node ? normalizePathCommands(node.d) : []);
  const next = node
    ? collectPathControlHandles(commands).flatMap(({ x, y, meta }) => {
        const point = api!.pathLocal2Viewport3D(node, [x, y]);
        if (!point) return [];
        const command = commands[meta.commandIndex];
        return [
          {
            x: point[0],
            y: point[1],
            meta,
            control:
              command[0] === 'C'
                ? meta.coordOffset !== 5
                : command[0] === 'Q' && meta.coordOffset === 1,
          },
        ];
      })
    : [];
  if (JSON.stringify(pathHandles.value) !== JSON.stringify(next))
    pathHandles.value = next;
}

function animatePathHandles() {
  if (!previewActive()) {
    anchorFrame = 0;
    return;
  }
  const extrude = ringNode()?.extrude3d;
  const cube = api?.getNodeById('iso-cube');
  steppedTones.value =
    cube?.type === 'mesh3d' && (cube.material3d?.toneSteps ?? 0) >= 2;
  showOutlines.value =
    cube?.type === 'mesh3d' && (cube.material3d?.outlineWidth ?? 0) > 0;
  showRimLight.value =
    cube?.type === 'mesh3d' && (cube.material3d?.rimLightStrength ?? 0) > 0;
  ringTilted.value =
    typeof extrude === 'object' &&
    !!extrude.rotation?.some((angle) => angle !== 0);
  refreshPathHandles();
  if (showCallouts.value) refreshCallouts();
  anchorFrame = requestAnimationFrame(animatePathHandles);
}

function refreshCallouts() {
  if (!api) return;
  syncPreviewBounds();
  const { width, height } = previewBounds.value;
  const cube = api.getNodeById('iso-cube');
  const cubeEntity = cube && api.getEntity(cube);
  const mesh = cubeEntity?.has(Mesh3DNode)
    ? cubeEntity.read(Mesh3DNode).meshEntity
    : undefined;
  const cubePosition = mesh?.has(Transform3D)
    ? mesh.read(Transform3D).translation
    : undefined;
  const cubeAnchor = cubePosition && api.world3D2Viewport(cubePosition);
  const ring = ringNode();
  const firstVertex =
    ring && collectPathControlHandles(normalizePathCommands(ring.d))[0];
  const ringAnchor =
    ring && firstVertex
      ? api.pathLocal2Viewport3D(ring, [firstVertex.x, firstVertex.y])
      : null;
  const next: Callout[] = [];
  for (const [id, title, point, side] of [
    [
      'cube',
      props.locale === 'zh' ? '立方体 Mesh' : 'Cube mesh',
      cubeAnchor,
      'right',
    ],
    [
      'ring',
      props.locale === 'zh' ? '挤出 SVG' : 'Extruded SVG',
      ringAnchor,
      'left',
    ],
  ] as const) {
    if (!point || !point.every(Number.isFinite)) continue;
    const [anchorX, anchorY] = point;
    if (anchorX < 0 || anchorX > width || anchorY < 0 || anchorY > height)
      continue;
    next.push({
      id,
      title,
      anchorX,
      anchorY,
      labelX: Math.max(
        4,
        Math.min(width - 144, anchorX + (side === 'right' ? 20 : -164)),
      ),
      labelY: Math.max(
        4,
        Math.min(height - 40, anchorY + (side === 'right' ? -54 : 18)),
      ),
    });
  }
  if (JSON.stringify(callouts.value) !== JSON.stringify(next))
    callouts.value = next;
}

function queuePathEdit() {
  const edit = pathEdit;
  const editor = api;
  if (!edit || !editor || edit.queued) return;
  edit.queued = true;
  editor.runAtNextTick(() => {
    edit.queued = false;
    const node = editor.getNodeById('iso-ring');
    if (node?.type !== 'path') return;
    const d = edit.cancelled ? edit.originalD : toPathData(edit.commands);
    if (node.d !== d) editor.updateNode(node, { d });
    if (edit.finished && !edit.cancelled && d !== edit.originalD)
      editor.record();
    if (pathEdit === edit && edit.finished) pathEdit = undefined;
  });
}

function finishPathEdit(cancelled: boolean) {
  if (!pathEdit) return;
  pathEdit.cancelled = cancelled;
  pathEdit.finished = true;
  queuePathEdit();
}

function onAnchorDown(event: PointerEvent, meta: PathControlHandleMeta) {
  stopAutoOrbit();
  const node = ringNode();
  const viewport = pointerViewport(event);
  if (!node || !viewport || event.button !== 0 || !event.isPrimary || pathEdit)
    return;
  event.stopPropagation();
  event.preventDefault();
  pathEdit = {
    pointerId: event.pointerId,
    meta,
    commands: normalizePathCommands(node.d),
    originalD: node.d,
    startViewport: viewport,
    moved: false,
    queued: false,
    finished: false,
    cancelled: false,
  };
  // The handle can disappear temporarily if a dragged contour invalidates the
  // extrusion. Keep pointer capture on the persistent overlay so pointerup
  // still commits the edit and undo can restore the last valid shape.
  (event.currentTarget as SVGCircleElement).ownerSVGElement?.setPointerCapture(
    event.pointerId,
  );
}

function onAnchorMove(event: PointerEvent) {
  const edit = pathEdit;
  const node = ringNode();
  if (!edit || !node || edit.pointerId !== event.pointerId || edit.finished)
    return;
  event.stopPropagation();
  const viewport = pointerViewport(event);
  if (!viewport) return;
  if (
    !edit.moved &&
    Math.hypot(
      viewport[0] - edit.startViewport[0],
      viewport[1] - edit.startViewport[1],
    ) < 3
  )
    return;
  edit.moved = true;
  const point = api!.viewport2PathLocal3D(node, {
    x: viewport[0],
    y: viewport[1],
  });
  if (!point) return;
  const commands = edit.commands.map((command) => [...command] as PathCommand);
  setPathHandlePoint(commands, edit.meta, point[0], point[1]);
  const d = toPathData(commands);
  const candidate = { ...node, d };
  // A transient invalid contour removes the companion mesh and its edit plane.
  // Keep the last valid shape so the next pointer move can still be projected.
  const scene = api!
    .getNodes()
    .map((item) => (item.id === candidate.id ? candidate : item));
  if (!canExtrudePath(candidate, scene)) return;
  edit.commands = commands;
  refreshPathHandles();
  queuePathEdit();
}

function onAnchorUp(event: PointerEvent) {
  const edit = pathEdit;
  if (edit?.pointerId !== event.pointerId) return;
  onAnchorMove(event);
  finishPathEdit(!edit.moved);
}

function onAnchorCancel(event: PointerEvent) {
  if (pathEdit?.pointerId === event.pointerId) finishPathEdit(true);
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
  const next = {
    left: canvas.left - host.left,
    top: canvas.top - host.top,
    width: canvas.width,
    height: canvas.height,
  };
  const prev = previewBounds.value;
  if (
    (Object.keys(next) as (keyof typeof next)[]).some(
      (key) => next[key] !== prev[key],
    )
  )
    previewBounds.value = next;
}

function onPointerDown(event: PointerEvent) {
  stopAutoOrbit();
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
    id: 'iso-sweep-light',
    type: 'light3d',
    lightType: 'spot',
    x: 385,
    y: 180,
    z: 170,
    direction: [-140, 0, -170],
    color: '#ffd4a0',
    intensity: 0,
    range: 400,
    innerConeAngle: 0.45,
    outerConeAngle: 0.8,
    castShadow: false,
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
  if (typeof IntersectionObserver !== 'undefined') {
    visibilityObserver = new IntersectionObserver(([entry]) => {
      previewInView = entry.isIntersecting;
      syncPreviewActivity();
    });
    visibilityObserver.observe(canvas);
  }
  onReady = (event) => {
    api = event.detail;
    api.setAppState({
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT, Pen.HAND, Pen.ORBIT_3D, Pen.DRAW_BOX_3D],
      penbarVisible: false,
      penbarNameLabelVisible: true,
      taskbarVisible: false,
    });
    api.runAtNextTick(() => {
      applyCamera();
      api?.updateNodes([...scene, ...svgNodes()]);
      // Establish a document baseline so a single anchor drag can be undone.
      api?.record();
      api?.runAtNextTick(syncPreviewActivity);
    });
  };
  canvas.addEventListener(Event.READY, onReady as EventListener);
  document.addEventListener('visibilitychange', onVisibilityChange);
  await ensureExampleWorld();
});
onUnmounted(() => {
  visibilityObserver?.disconnect();
  cancelAnimationFrame(anchorFrame);
  if (animationFrame) cancelAnimationFrame(animationFrame);
  document.removeEventListener('visibilitychange', onVisibilityChange);
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
        {{ props.locale === 'zh' ? '平移' : 'Pan' }}
      </button>
      <button
        :aria-pressed="tool === Pen.ORBIT_3D"
        @click="setTool(Pen.ORBIT_3D)"
      >
        {{ props.locale === 'zh' ? '旋转视角' : 'Orbit' }}
      </button>
      <button
        :aria-pressed="tool === Pen.DRAW_BOX_3D"
        @click="setTool(Pen.DRAW_BOX_3D)"
      >
        {{ props.locale === 'zh' ? '绘制盒子' : 'Draw box' }}
      </button>
      <button
        :aria-pressed="tool === 'edit-path-3d'"
        @click="setTool('edit-path-3d')"
      >
        {{ props.locale === 'zh' ? '编辑 SVG 锚点' : 'Edit SVG anchors' }}
      </button>
      <button :aria-pressed="ringTilted" @click="toggleRingTilt">
        {{ props.locale === 'zh' ? '倾斜 SVG' : 'Tilt SVG' }}
      </button>
      <button
        :aria-pressed="showCallouts"
        @click="showCallouts = !showCallouts"
      >
        {{ props.locale === 'zh' ? '显示标注' : 'Show callouts' }}
      </button>
      <button :aria-pressed="steppedTones" @click="toggleSteppedTones">
        {{ props.locale === 'zh' ? '分层色阶' : 'Stepped tones' }}
      </button>
      <button :aria-pressed="showOutlines" @click="toggleOutlines">
        {{ props.locale === 'zh' ? '显示轮廓' : 'Show outlines' }}
      </button>
      <button :aria-pressed="showRimLight" @click="toggleRimLight">
        {{ props.locale === 'zh' ? '边缘光' : 'Rim light' }}
      </button>
      <button :aria-pressed="sweepLight" @click="toggleSweepLight">
        {{ props.locale === 'zh' ? '动态聚光灯' : 'Moving spotlight' }}
      </button>
      <button :aria-pressed="autoOrbit" @click="toggleAutoOrbit">
        {{ props.locale === 'zh' ? '自动环绕' : 'Auto orbit' }}
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
        ? '选择“绘制盒子”，在指定 Z 平面上拖出底面；或选择“编辑 SVG 锚点”，拖动橙色环的外轮廓与孔洞锚点。“倾斜 SVG”可验证旋转后的前表面锚点编辑。多选后上下拖动共用 Gizmo 的黄色菱形，可围绕选区中心等比缩放。选择工具可框选，Shift 可从地板开始框选。选择“平移”或“旋转视角”后可直接拖动，触屏也适用；滚轮缩放，双指平移或缩放。'
        : 'Choose Draw box to drag a base on the selected Z plane, or Edit SVG anchors to drag the orange ring’s outer and hole vertices. Tilt SVG lets you edit anchors on the rotated front face. Drag the shared gizmo’s yellow diamond up or down to scale a selection uniformly around its center. Select can marquee meshes, and Shift starts a marquee over the ground. Choose Pan or Orbit to drag the view directly, including by touch. Wheel zooms, and two fingers pan or pinch to zoom.'
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
      @wheel="stopAutoOrbit"
    />
    <svg
      class="isometric-preview"
      aria-hidden="true"
      @pointermove="onAnchorMove"
      @pointerup="onAnchorUp"
      @pointercancel="onAnchorCancel"
      :style="{
        left: `${previewBounds.left}px`,
        top: `${previewBounds.top}px`,
        width: `${previewBounds.width}px`,
        height: `${previewBounds.height}px`,
      }"
    >
      <polygon v-if="previewPoints" :points="previewPoints" />
      <circle
        v-for="handle in pathHandles"
        :key="`${handle.meta.commandIndex}-${handle.meta.coordOffset}`"
        class="path-anchor"
        :class="{ control: handle.control }"
        :cx="handle.x"
        :cy="handle.y"
        r="7"
        @pointerdown="onAnchorDown($event, handle.meta)"
      />
    </svg>
    <svg
      v-if="showCallouts"
      class="isometric-callouts"
      aria-hidden="true"
      :style="{
        left: `${previewBounds.left}px`,
        top: `${previewBounds.top}px`,
        width: `${previewBounds.width}px`,
        height: `${previewBounds.height}px`,
      }"
    >
      <g
        v-for="callout in callouts"
        :key="callout.id"
        :data-callout="callout.id"
      >
        <line
          :x1="callout.anchorX"
          :y1="callout.anchorY"
          :x2="callout.labelX + (callout.id === 'cube' ? 0 : 140)"
          :y2="callout.labelY + 19"
        />
        <circle :cx="callout.anchorX" :cy="callout.anchorY" r="4" />
        <rect
          :x="callout.labelX"
          :y="callout.labelY"
          width="140"
          height="38"
          rx="7"
        />
        <text :x="callout.labelX + 12" :y="callout.labelY + 24">
          {{ callout.title }}
        </text>
      </g>
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
  flex-wrap: wrap;
  gap: 0.3rem;
}
.isometric-tools button {
  white-space: nowrap;
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 0.3rem;
}
.isometric-tools button[aria-pressed='true'] {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}
@media (max-width: 640px) {
  .isometric-tools {
    width: 100%;
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 0.2rem;
  }
  .isometric-tools button {
    flex: none;
  }
}
.isometric-hint {
  margin: 0 0 0.75rem;
  font-size: 0.9em;
}
.isometric-canvas {
  position: relative;
  touch-action: none;
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
  touch-action: none;
}
.isometric-preview polygon {
  fill: #43a98a66;
  stroke: #238b6d;
  stroke-width: 2;
}
.isometric-preview .path-anchor {
  fill: white;
  stroke: #db6b24;
  stroke-width: 2;
  pointer-events: all;
  cursor: move;
  touch-action: none;
}
.isometric-preview .path-anchor.control {
  fill: #db6b24;
}
.isometric-callouts {
  position: absolute;
  pointer-events: none;
  overflow: hidden;
}
.isometric-callouts line {
  stroke: var(--vp-c-brand-1);
  stroke-width: 1.5;
}
.isometric-callouts circle {
  fill: var(--vp-c-brand-1);
  stroke: var(--vp-c-bg);
  stroke-width: 2;
}
.isometric-callouts rect {
  fill: var(--vp-c-bg);
  stroke: var(--vp-c-brand-1);
  stroke-width: 1;
}
.isometric-callouts text {
  fill: var(--vp-c-text-1);
  font-size: 13px;
  font-weight: 600;
}
</style>
