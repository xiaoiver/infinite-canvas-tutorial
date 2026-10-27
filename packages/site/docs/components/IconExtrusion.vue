<script setup lang="ts">
import {
  Pen,
  GPUResource,
  ICON_3D_MATERIALS,
  iconFontToExtrudedPaths,
  registerIconifyIconSet,
  type API,
  type Icon3DMaterial,
  type IconFontSerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { onMounted, onUnmounted, ref } from 'vue';
import { Event as CanvasEvent } from '@infinite-canvas-tutorial/webcomponents';
import { ensureExampleWorld } from '../lib/ensure-example-world';

const wrapper = ref<HTMLElement | null>(null);
const iconName = ref<'search' | 'ring'>('search');
const material = ref<Icon3DMaterial>('metal');
const depth = ref(45);
let api: API | undefined;
let onReady: ((event: CustomEvent<API>) => void) | undefined;

function render() {
  if (!api) return;
  const icon: IconFontSerializedNode = {
    id: 'icon-3d-source',
    type: 'iconfont',
    iconFontFamily: 'lesson-39-icons',
    iconFontName: iconName.value,
    x: 130,
    y: 70,
    width: 160,
    height: 160,
    stroke: '#3b82f6',
    fill: '#f97316',
  };
  const result = iconFontToExtrudedPaths(icon, {
    depth: depth.value,
    bevelSize: 2,
    bevelSegments: 3,
    rotation: [0.45, -0.35, 0],
    ...ICON_3D_MATERIALS[material.value],
  });
  if (result)
    void api.edit(
      (editor) =>
        editor.replaceDocument([result.group, ...result.paths], 'remote'),
      { capture: 'NEVER' },
    );
}

onMounted(async () => {
  registerIconifyIconSet('lesson-39-icons', {
    width: 24,
    height: 24,
    icons: {
      search: {
        body: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></g>',
      },
      ring: {
        body: '<path d="M0 0 H24 V24 H0 Z M6 6 H18 V18 H6 Z" fill="currentColor" fill-rule="evenodd" />',
      },
    },
  });
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
    api.runAtNextTick(render);
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
  <div>
    <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 330px" />
    <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 0.75rem">
      <label
        >Icon
        <select v-model="iconName" @change="render">
          <option value="search">Stroke: Search</option>
          <option value="ring">Fill with hole: Ring</option>
        </select></label
      >
      <label
        >Material
        <select v-model="material" @change="render">
          <option value="matte">Matte</option>
          <option value="glossy">Glossy</option>
          <option value="metal">Metal</option>
        </select></label
      >
      <label
        >Depth {{ depth }}
        <input
          v-model.number="depth"
          type="range"
          min="10"
          max="90"
          @change="render"
      /></label>
    </div>
  </div>
</template>
