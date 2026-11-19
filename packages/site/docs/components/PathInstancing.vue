<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import {
  Canvas,
  CanvasMode,
  Path,
  Group,
  CheckboardStyle,
} from '@infinite-canvas-tutorial/core';
import {
  Culled,
  GPUResource,
  Renderable,
  Pen,
  ExportFormat,
  type API,
  type SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { Event } from '@infinite-canvas-tutorial/webcomponents';
import { ensureExampleWorld } from '../lib/ensure-example-world';
import {
  observeWebGLFrame,
  type WebGLFrameWork,
} from '../lib/observe-webgl-frame';

const props = withDefaults(defineProps<{ locale?: 'en' | 'zh' }>(), {
  locale: 'en',
});
const zh = computed(() => props.locale === 'zh');
const coreElement = ref<HTMLCanvasElement>();
const ecsElement = ref<HTMLElement>();
const ready = ref(false),
  busy = ref(false),
  enabled = ref(true);
const count = ref(100),
  alternating = ref(false),
  pan = ref(false);
const exportBusy = ref(false);
const error = ref(''),
  preview = ref('');
const coreVisible = ref(0),
  ecsVisible = ref(0),
  ecsSelected = ref(0);
const emptyWork = (): WebGLFrameWork => ({
  drawcalls: 0,
  indices: 0,
  vertices: 0,
});
const coreWork = ref(emptyWork()),
  ecsWork = ref(emptyWork());
let coreReady = false;
let core: Canvas | undefined, api: API | undefined;
let group = new Group(),
  paths: Path[] = [],
  nodes: SerializedNode[] = [];
let disposed = false,
  frame = 0,
  lastSample = 0,
  exporting = false;
let observer: ResizeObserver | undefined;
const cleanups: (() => void)[] = [];
const geometry = (variant: number) =>
  `M0 0 L${variant ? 16 : 18} 0 L20 20 L10 14 L0 20 Z`;
function fail(reason: unknown) {
  if (!disposed) error.value = String(reason);
}
function fit(width: number, height: number) {
  const columns = Math.ceil(Math.sqrt(count.value * 2));
  const rows = Math.ceil(count.value / columns);
  return Math.min(
    1,
    (width - 24) / (columns * 26),
    (height - 24) / (rows * 26),
  );
}
async function overview() {
  if (!core || !api || disposed) return;
  const element = coreElement.value!;
  core.camera.x = 0;
  core.camera.y = 0;
  core.camera.zoom = fit(element.clientWidth, element.clientHeight);
  const rect = api.getCanvasElement().getBoundingClientRect();
  await api.edit(
    (e) => {
      e.selectNodes([]);
      e.highlightNodes([]);
      e.setAppState({
        cameraX: 0,
        cameraY: 0,
        cameraZoom: fit(rect.width, rect.height),
      });
    },
    { capture: 'NEVER' },
  );
}
async function reset() {
  if (!core || !api || disposed) return;
  busy.value = true;
  error.value = '';
  try {
    core.removeChild(group);
    group = new Group();
    core.appendChild(group);
    paths = [];
    const columns = Math.ceil(Math.sqrt(count.value * 2));
    nodes = Array.from({ length: count.value }, (_, i) => {
      const d = geometry(alternating.value ? i % 2 : 0);
      const x = 12 + (i % columns) * 26,
        y = 12 + Math.floor(i / columns) * 26;
      const fill = ['#2563eb', '#dc2626', '#16a34a'][i % 3];
      const path = new Path({
        d,
        fill,
        stroke: 'none',
        strokeWidth: 0,
        batchable: true,
      });
      path.position.set(x, y);
      group.appendChild(path);
      paths.push(path);
      return {
        id: `instance-path-${i}`,
        type: 'path',
        d,
        x,
        y,
        width: 20,
        height: 20,
        zIndex: i,
        fills: [{ type: 'solid', value: fill }],
        strokeWidth: 0,
      };
    });
    core.pathInstancing = enabled.value;
    api.setPathInstancingEnabled(enabled.value);
    await api.edit(
      (e) => {
        e.selectNodes([]);
        e.highlightNodes([]);
        e.replaceDocument(nodes, 'remote');
        for (const node of nodes)
          e.getEntity(node).write(Renderable).batchable = true;
        e.setAppState({
          penbarSelected: Pen.SELECT,
          penbarAll: [Pen.SELECT, Pen.HAND],
          penbarVisible: false,
          taskbarVisible: false,
        });
      },
      { capture: 'NEVER' },
    );
    pan.value = false;
    core.mode = CanvasMode.SELECT;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    await overview();
  } catch (reason) {
    fail(reason);
  } finally {
    if (!disposed) busy.value = false;
  }
}
function toggle() {
  if (!core || !api) return;
  core.pathInstancing = enabled.value;
  api.setPathInstancingEnabled(enabled.value);
}
async function togglePan() {
  pan.value = !pan.value;
  if (core) core.mode = pan.value ? CanvasMode.HAND : CanvasMode.SELECT;
  await api?.edit(
    (e) => e.setAppState({ penbarSelected: pan.value ? Pen.HAND : Pen.SELECT }),
    { capture: 'NEVER' },
  );
}
async function clearSelection() {
  for (const path of paths) core?.deselectShape(path);
  await api?.edit(
    (e) => {
      e.selectNodes([]);
      e.highlightNodes([]);
    },
    { capture: 'NEVER' },
  );
}
async function exportCore() {
  if (!core) return;
  exporting = true;
  exportBusy.value = true;
  try {
    preview.value = await core.toDataURL({ grid: false });
  } catch (reason) {
    fail(reason);
  } finally {
    exporting = false;
    exportBusy.value = false;
  }
}
function exportECS() {
  if (!api) return;
  // The screenshot event completes this asynchronous ECS request.
  exporting = true;
  exportBusy.value = true;
  try {
    api.export({ format: ExportFormat.PNG, download: false });
  } catch (reason) {
    exporting = false;
    exportBusy.value = false;
    fail(reason);
  }
}
function screenshot(event: globalThis.Event) {
  const data = (event as CustomEvent<{ dataURL?: string }>).detail;
  if (!disposed && data.dataURL) preview.value = data.dataURL;
  exporting = false;
  exportBusy.value = false;
}
function sample(time: number) {
  if (disposed) return;
  try {
    core?.render();
    if (api && time - lastSample > 150) {
      lastSample = time;
      coreVisible.value = paths.filter((p) => p.visible && !p.culled).length;
      ecsVisible.value = nodes.filter((n) => {
        const e = api!.getEntity(n);
        return e && !e.has(Culled);
      }).length;
      ecsSelected.value = api.getAppState().layersSelected.length;
    }
  } catch (reason) {
    fail(reason);
  }
  frame = requestAnimationFrame(sample);
}
async function onReady(event: globalThis.Event) {
  if (api || disposed) return;
  api = (event as CustomEvent<API>).detail;
  try {
    const device = api.getCanvas().read(GPUResource).device;
    cleanups.push(
      observeWebGLFrame(device, api.getCanvasElement(), (work) => {
        if (!disposed && !exporting) ecsWork.value = work;
      }),
    );
    if (coreReady) {
      await reset();
      if (!disposed) ready.value = true;
    }
  } catch (reason) {
    fail(reason);
  }
}
onMounted(async () => {
  const element = coreElement.value!,
    host = ecsElement.value!;
  host.addEventListener(Event.READY, onReady);
  host.addEventListener(Event.SCREENSHOT_DOWNLOADED, screenshot);
  cleanups.push(() => {
    host.removeEventListener(Event.READY, onReady);
    host.removeEventListener(Event.SCREENSHOT_DOWNLOADED, screenshot);
  });
  try {
    const dpr = window.devicePixelRatio || 1;
    element.width = Math.round(element.clientWidth * dpr);
    element.height = Math.round(element.clientHeight * dpr);
    const created = new Canvas({
      canvas: element,
      devicePixelRatio: dpr,
      mode: CanvasMode.SELECT,
      checkboardStyle: CheckboardStyle.NONE,
    });
    core = created;
    await created.initialized;
    if (disposed) {
      created.destroy();
      core = undefined;
      return;
    }
    coreReady = true;
    cleanups.push(
      observeWebGLFrame(core.getDevice(), element, (work) => {
        if (!disposed && !exporting) coreWork.value = work;
      }),
    );
    core.appendChild(group);
    observer = new ResizeObserver(() => {
      if (!core || disposed) return;
      const width = Math.round(element.clientWidth * dpr),
        height = Math.round(element.clientHeight * dpr);
      if (element.width !== width || element.height !== height)
        core.resize(width / dpr, height / dpr);
    });
    observer.observe(element);
    frame = requestAnimationFrame(sample);
    await ensureExampleWorld();
    if (api && !ready.value && !disposed) {
      await reset();
      ready.value = true;
    }
  } catch (reason) {
    fail(reason);
  }
});
onUnmounted(() => {
  disposed = true;
  cancelAnimationFrame(frame);
  observer?.disconnect();
  cleanups.reverse().forEach((cleanup) => cleanup());
  if (coreReady) core?.destroy();
  core = undefined;
  api = undefined;
  paths = [];
  nodes = [];
});
</script>

<template>
  <div class="path-instancing-example">
    <fieldset :disabled="!ready || busy || exportBusy">
      <label
        ><input v-model="enabled" type="checkbox" @change="toggle" />{{
          zh ? 'Path 合批' : 'Path instancing'
        }}</label
      >
      <label
        >{{ zh ? 'Path 数量' : 'Paths' }}
        <select v-model.number="count" @change="reset">
          <option :value="100">100</option>
          <option :value="1000">1,000</option>
        </select></label
      >
      <label
        ><input v-model="alternating" type="checkbox" @change="reset" />{{
          zh ? '交替几何' : 'Alternating geometry'
        }}</label
      >
      <button type="button" @click="overview().catch(fail)">
        {{ zh ? '总览' : 'Overview' }}
      </button>
      <button
        type="button"
        :aria-pressed="pan"
        @click="togglePan().catch(fail)"
      >
        {{ zh ? '平移画布' : 'Pan canvas' }}
      </button>
      <button type="button" @click="clearSelection().catch(fail)">
        {{ zh ? '取消选择' : 'Clear selection' }}
      </button>
      <button type="button" @click="exportCore">
        {{ zh ? '导出 Core PNG' : 'Export Core PNG' }}
      </button>
      <button type="button" @click="exportECS">
        {{ zh ? '导出 ECS PNG' : 'Export ECS PNG' }}
      </button>
    </fieldset>
    <p>
      {{
        zh
          ? '本示例主动开启合批；两个包默认均关闭。点击或框选原始 Path，切换平移后拖动或滚轮缩放。交替几何会打断相邻批次，颜色变化不会。'
          : 'This example opts in; both packages default to off. Click or marquee-select original Paths, or pan and scroll to zoom. Alternating geometry breaks adjacent batches; changing color does not.'
      }}
    </p>
    <div class="canvases">
      <section id="path-instancing-core" aria-label="Core">
        <h3>Core</h3>
        <dl>
          <div>
            <dt>{{ zh ? '可见 Path' : 'Visible Paths' }}</dt>
            <dd data-testid="core-visible">{{ coreVisible }}</dd>
          </div>
          <div>
            <dt>drawcalls</dt>
            <dd data-testid="core-drawcalls">{{ coreWork.drawcalls }}</dd>
          </div>
          <div>
            <dt>{{ zh ? '索引 / 顶点' : 'Indices / vertices' }}</dt>
            <dd>{{ coreWork.indices }} / {{ coreWork.vertices }}</dd>
          </div>
        </dl>
        <canvas ref="coreElement" aria-label="Core Path canvas" />
      </section>
      <section id="path-instancing-ecs" aria-label="ECS">
        <h3>ECS</h3>
        <dl>
          <div>
            <dt>{{ zh ? '可见 Path' : 'Visible Paths' }}</dt>
            <dd data-testid="ecs-visible">{{ ecsVisible }}</dd>
          </div>
          <div>
            <dt>drawcalls</dt>
            <dd data-testid="ecs-drawcalls">{{ ecsWork.drawcalls }}</dd>
          </div>
          <div>
            <dt>{{ zh ? '索引 / 顶点' : 'Indices / vertices' }}</dt>
            <dd>{{ ecsWork.indices }} / {{ ecsWork.vertices }}</dd>
          </div>
          <div>
            <dt>{{ zh ? '选中' : 'Selected' }}</dt>
            <dd data-testid="ecs-selected">{{ ecsSelected }}</dd>
          </div>
        </dl>
        <ic-spectrum-canvas ref="ecsElement" />
      </section>
    </div>
    <p>
      {{
        zh
          ? '指标是各画布最近完成的屏幕帧中真实 WebGL 提交，含背景与交互覆盖层；索引和顶点乘以实例数，二者分开统计。静止时保留最近一帧，导出帧不计入。此计数不是 GPU 耗时或帧率基准。'
          : 'Counters observe actual WebGL submissions in each canvas’s last completed screen frame, including background and interaction overlays. Indexed and nonindexed vertex counts include instances and are reported separately. Idle canvases retain the last frame; exports are excluded. These are not GPU timings or an FPS benchmark.'
      }}
    </p>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-else-if="!ready || busy" role="status">
      {{ zh ? '正在准备 Path 场景…' : 'Preparing Path scenes…' }}
    </p>
    <figure v-if="preview">
      <figcaption>
        {{ zh ? '完整精度 PNG 预览' : 'Full precision PNG preview' }}
      </figcaption>
      <img
        :src="preview"
        :alt="zh ? '导出的 Path 场景' : 'Exported Path scene'"
      />
    </figure>
  </div>
</template>

<style scoped>
fieldset {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 0;
  border: 0;
  margin: 0 0 16px;
}
label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
button,
select {
  border: 1px solid var(--vp-c-divider, #ccc);
  border-radius: 5px;
  padding: 5px 9px;
  font: inherit;
  font-size: 13px;
}
button {
  cursor: pointer;
}
button:disabled {
  cursor: default;
  opacity: 0.5;
}
.canvases {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
}
h3 {
  margin: 0 0 8px;
}
dl {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin: 0 0 10px;
}
dl div {
  display: flex;
  gap: 6px;
}
dt,
p,
figcaption {
  font-size: 13px;
}
dd {
  margin: 0;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
canvas,
ic-spectrum-canvas {
  display: block;
  width: 100%;
  height: 300px;
  border: 1px solid var(--vp-c-divider, #ddd);
  border-radius: 8px;
  overflow: hidden;
  touch-action: none;
}
figure {
  margin: 12px 0;
}
img {
  max-width: 100%;
}
</style>
