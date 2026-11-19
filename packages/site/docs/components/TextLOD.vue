<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import {
  ComputedLOD,
  Culled,
  Pen,
  Renderable,
  type API,
  type SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { Event } from '@infinite-canvas-tutorial/webcomponents';
import { ensureExampleWorld } from '../lib/ensure-example-world';

const props = withDefaults(defineProps<{ locale?: 'en' | 'zh' }>(), {
  locale: 'en',
});
const zh = computed(() => props.locale === 'zh');
const host = ref<HTMLElement>();
const ready = ref(false);
const busy = ref(false);
const error = ref('');
const enabled = ref(true);
const count = ref(400);
const zoom = ref(1);
const visible = ref(0);
const full = ref(0);
const proxy = ref(0);
const selected = ref(false);
const pan = ref(false);
const fontSize = 18;
let api: API | undefined;
let element: HTMLElement | undefined;
let disposed = false;
let frame = 0;
let lastSample = 0;
let columns = 1;
let rows = 1;
let labels: SerializedNode[] = [];

function fail(reason: unknown) {
  if (!disposed) error.value = String(reason);
}
function sample(time: number) {
  if (disposed) return;
  if (api && time - lastSample >= 200) {
    lastSample = time;
    zoom.value = api.getAppState().cameraZoom;
    pan.value = api.getAppState().penbarSelected === Pen.HAND;
    selected.value = api.getAppState().layersSelected.length > 0;
    let fullCount = 0,
      proxyCount = 0;
    for (const node of labels) {
      const entity = api.getEntity(node);
      if (!entity || entity.has(Culled)) continue;
      if (
        entity.has(ComputedLOD) &&
        entity.read(ComputedLOD).level === 'text-proxy'
      )
        proxyCount++;
      else fullCount++;
    }
    full.value = fullCount;
    proxy.value = proxyCount;
    visible.value = fullCount + proxyCount;
  }
  frame = requestAnimationFrame(sample);
}
async function setZoom(value: number) {
  try {
    await api?.edit((e) => e.setAppState({ cameraZoom: value }), {
      capture: 'NEVER',
    });
  } catch (reason) {
    fail(reason);
  }
}
function viewportSize() {
  const rect = api?.getCanvasElement().getBoundingClientRect();
  return {
    width: rect?.width || element?.clientWidth || 640,
    height: rect?.height || 350,
  };
}
async function overview() {
  const size = viewportSize();
  const fit = Math.min(
    0.25,
    (size.width - 32) / (columns * 220 + 64),
    (size.height - 32) / (rows * 64 + 64),
  );
  try {
    await api?.edit(
      (e) => {
        e.selectNodes([]);
        e.highlightNodes([]);
        e.setAppState({
          cameraX: 0,
          cameraY: 0,
          cameraZoom: Math.max(0.03, fit),
        });
      },
      { capture: 'NEVER' },
    );
  } catch (reason) {
    fail(reason);
  }
}
async function reset() {
  if (!api || disposed) return;
  busy.value = true;
  error.value = '';
  columns = Math.max(
    1,
    Math.round(
      Math.sqrt(
        (count.value * (viewportSize().width / viewportSize().height) * 64) /
          220,
      ),
    ),
  );
  rows = Math.ceil(count.value / columns);
  const colors = ['#1864ab', '#6741d9', '#087f5b', '#a61e4d'];
  const next: SerializedNode[] = Array.from(
    { length: count.value },
    (_, i) => ({
      id: `lod-label-${i}`,
      type: 'text',
      x: 32 + (i % columns) * 220,
      y: 32 + Math.floor(i / columns) * 64,
      width: 200,
      height: 44,
      zIndex: i,
      content: `Canvas label ${String(i + 1).padStart(
        3,
        '0',
      )}\nZoom in for details`,
      fontFamily: 'sans-serif',
      fontSize,
      fills: [{ type: 'solid', value: colors[i % colors.length] }],
    }),
  );
  try {
    api.setTextLODEnabled(enabled.value);
    await api.edit(
      (e) => {
        e.selectNodes([]);
        e.highlightNodes([]);
        e.replaceDocument(next, 'remote');
        for (const node of next)
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
    labels = next;
    // The canvas toolbar can change the drawing area's height during setup.
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
  try {
    api?.setTextLODEnabled(enabled.value);
  } catch (reason) {
    fail(reason);
  }
}
async function selectVisible() {
  try {
    await api?.edit(
      (e) => {
        const node = labels.find((n) => {
          const entity = e.getEntity(n);
          return !!entity && !entity.has(Culled);
        });
        if (node) {
          e.setAppState({ penbarSelected: Pen.SELECT });
          e.selectNodes([node]);
        }
      },
      { capture: 'NEVER' },
    );
  } catch (reason) {
    fail(reason);
  }
}
async function togglePan() {
  try {
    await api?.edit(
      (e) => {
        e.selectNodes([]);
        e.setAppState({
          penbarSelected:
            e.getAppState().penbarSelected === Pen.HAND ? Pen.SELECT : Pen.HAND,
        });
      },
      { capture: 'NEVER' },
    );
  } catch (reason) {
    fail(reason);
  }
}
async function clearSelection() {
  try {
    await api?.edit(
      (e) => {
        e.selectNodes([]);
        e.highlightNodes([]);
      },
      { capture: 'NEVER' },
    );
  } catch (reason) {
    fail(reason);
  }
}
function onReady(event: globalThis.Event) {
  if (disposed || api) return;
  api = (event as CustomEvent<API>).detail;
  reset()
    .then(() => {
      if (disposed) return;
      ready.value = true;
      frame = requestAnimationFrame(sample);
    })
    .catch(fail);
}
onMounted(async () => {
  element = host.value;
  element?.addEventListener(Event.READY, onReady);
  try {
    await ensureExampleWorld();
  } catch (reason) {
    fail(reason);
  }
});
onUnmounted(() => {
  disposed = true;
  cancelAnimationFrame(frame);
  element?.removeEventListener(Event.READY, onReady);
  api = undefined;
  labels = [];
});
</script>

<template>
  <div class="text-lod-example">
    <fieldset :disabled="!ready || busy">
      <label
        ><input v-model="enabled" type="checkbox" @change="toggle" />{{
          zh ? '文字 LOD' : 'Text LOD'
        }}</label
      >
      <label
        >{{ zh ? '文字数量' : 'Labels' }}
        <select v-model.number="count" @change="reset">
          <option :value="100">100</option>
          <option :value="400">400</option>
          <option :value="1000">1,000</option>
        </select>
      </label>
      <label
        >{{ zh ? '缩放' : 'Zoom' }}
        <input
          type="range"
          min="0.03"
          max="2"
          step="0.01"
          :value="zoom"
          @input="setZoom(Number(($event.target as HTMLInputElement).value))"
        />
        <output>{{ Math.round(zoom * 100) }}%</output>
      </label>
      <button type="button" @click="overview">
        {{ zh ? '总览' : 'Overview' }}
      </button>
      <button type="button" @click="setZoom(7 / fontSize)">
        {{ zh ? '7 px 滞回区间' : '7 px hysteresis band' }}
      </button>
      <button type="button" @click="setZoom(1)">
        {{ zh ? '查看细节' : 'Detail' }}
      </button>
      <button type="button" :aria-pressed="pan" @click="togglePan">
        {{ zh ? '平移画布' : 'Pan canvas' }}
      </button>
      <button type="button" :disabled="!visible" @click="selectVisible">
        {{ zh ? '选中可见文字' : 'Select a visible label' }}
      </button>
      <button type="button" :disabled="!selected" @click="clearSelection">
        {{ zh ? '取消选择' : 'Clear selection' }}
      </button>
    </fieldset>
    <dl class="lod-counts" aria-live="polite" aria-atomic="true">
      <div>
        <dt>{{ zh ? '可见文字' : 'Visible labels' }}</dt>
        <dd data-testid="lod-visible">{{ visible }}</dd>
      </div>
      <div>
        <dt>{{ zh ? '完整文字' : 'Full text' }}</dt>
        <dd data-testid="lod-full">{{ full }}</dd>
      </div>
      <div>
        <dt>{{ zh ? '代理文字' : 'Proxy text' }}</dt>
        <dd data-testid="lod-proxy">{{ proxy }}</dd>
      </div>
      <div>
        <dt>{{ zh ? '基准屏幕字号' : 'Base font on screen' }}</dt>
        <dd>{{ (fontSize * zoom).toFixed(1) }} CSS px</dd>
      </div>
    </dl>
    <p>
      {{
        zh
          ? '本示例主动开启 LOD；库默认关闭。缩小到 6 CSS px 以下进入代理，放大超过 8 CSS px 恢复完整文字。试着从总览和细节两侧进入 7 px 区间，观察滞回。'
          : 'This demo explicitly enables LOD; the library default is off. Below 6 CSS px, text becomes a line proxy; above 8 CSS px, full text returns. Enter the 7 px band from Overview and from Detail to see hysteresis.'
      }}
    </p>
    <p>
      {{
        zh
          ? '点击或悬停文字会恢复完整字形，双击可编辑。点击“平移画布”后拖动，或使用滚轮缩放；选中与拾取仍使用原始文字几何。计数是可见文字对象数，不是 drawcall 数或性能基准。'
          : 'Click or hover to restore full glyphs; double-click to edit. Use Pan canvas to drag, or scroll to zoom. Selection and picking use the original text geometry. Counts describe visible text objects, not drawcalls or benchmark timings.'
      }}
    </p>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-else-if="!ready || busy" role="status">
      {{ zh ? '正在准备文字场景…' : 'Preparing text scene…' }}
    </p>
    <ic-spectrum-canvas ref="host" class="lod-canvas" />
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
input[type='range'] {
  width: 120px;
}
.lod-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 24px;
  margin: 0;
}
.lod-counts div {
  display: flex;
  gap: 8px;
  align-items: baseline;
}
dt {
  font-size: 13px;
  color: var(--vp-c-text-2, #555);
}
dd {
  margin: 0;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
p {
  font-size: 13px;
  line-height: 1.6;
}
.lod-canvas {
  display: block;
  width: 100%;
  height: 400px;
  border: 1px solid var(--vp-c-divider, #ddd);
  border-radius: 8px;
  overflow: hidden;
}
</style>
