<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  Canvas,
  Text,
  CheckboardStyle,
  Theme,
} from '@infinite-canvas-tutorial/core';

const props = defineProps({ locale: { type: String, default: 'en' } });
const zh = computed(() => props.locale === 'zh');
const words = computed(() =>
  zh.value
    ? {
        text: '文字',
        path: '路径',
        curve: '贝塞尔曲线',
        circle: '圆形',
        line: '直线',
        align: '对齐',
        start: '起点',
        center: '居中',
        end: '终点',
        side: '方向',
        left: '正向',
        right: '另一侧',
        size: '字号',
        spacing: '字距',
        offset: '沿路径偏移',
        normal: '基线距离',
        bounds: '显示选框',
        hint: '拖动文字或蓝色手柄可沿路径移动；拖动橙色控制点可改变曲线。手柄也支持方向键，Esc 取消拖动。',
        move: '沿路径移动文字',
        point: '调整曲线控制点',
        ready: '已就绪',
        loading: '正在初始化…',
      }
    : {
        text: 'Text',
        path: 'Path',
        curve: 'Bézier curve',
        circle: 'Circle',
        line: 'Line',
        align: 'Alignment',
        start: 'Start',
        center: 'Center',
        end: 'End',
        side: 'Direction',
        left: 'Forward',
        right: 'Other side',
        size: 'Font size',
        spacing: 'Letter spacing',
        offset: 'Along-path offset',
        normal: 'Baseline distance',
        bounds: 'Show bounds',
        hint: 'Drag the text or blue handle along the path. Drag orange control points to reshape the curve. Handles support arrow keys; Esc cancels a drag.',
        move: 'Move text along the path',
        point: 'Adjust curve control point',
        ready: 'Ready',
        loading: 'Initializing…',
      },
);
const surface = ref<HTMLCanvasElement>();
const overlay = ref<SVGSVGElement>();
const guide = ref<SVGPathElement>();
const content = ref('Text follows your curve');
const preset = ref('curve');
const align = ref<CanvasTextAlign>('center');
const side = ref<'left' | 'right'>('left');
const fontSize = ref(30);
const letterSpacing = ref(1);
const startOffset = ref(0);
const pathOffset = ref(0);
const showBounds = ref(true);
const points = ref([
  { x: 65, y: 220 },
  { x: 170, y: 35 },
  { x: 430, y: 35 },
  { x: 535, y: 220 },
]);
const width = 600,
  height = 320;
const path = computed(() =>
  preset.value === 'circle'
    ? 'M195 160A105 105 0 1 1 405 160A105 105 0 1 1 195 160Z'
    : preset.value === 'line'
    ? 'M65 190L535 190'
    : `M${points.value[0].x} ${points.value[0].y}C${points.value
        .slice(1)
        .map((p) => `${p.x} ${p.y}`)
        .join(' ')}`,
);
const length = ref(470);
const anchor = ref({ x: 300, y: 100 });
const bounds = ref({ x: 0, y: 0, width: 0, height: 0 });
const ready = ref(false);
const error = ref('');
let canvas: Canvas | undefined;
let text: Text | undefined;
let disposed = false;
let drag:
  | {
      id: number;
      point?: number;
      previous: number;
      offset: number;
      points: { x: number; y: number }[];
    }
  | undefined;

function redraw() {
  if (!canvas || !text || !guide.value) return;
  Object.assign(text, {
    content: content.value,
    path: path.value,
    fontSize: fontSize.value,
    textAlign: align.value,
    side: side.value,
    letterSpacing: letterSpacing.value,
    startOffset: startOffset.value,
    pathOffset: pathOffset.value,
  });
  canvas.render();
  const b = text.getGeometryBounds();
  bounds.value = {
    x: b.minX,
    y: b.minY,
    width: b.maxX - b.minX,
    height: b.maxY - b.minY,
  };
  length.value = guide.value.getTotalLength();
  const justify =
    align.value === 'center' ? 0.5 : align.value === 'end' ? 1 : 0;
  let distance = startOffset.value + justify * length.value;
  if (side.value === 'right') distance = length.value - distance;
  distance =
    preset.value === 'circle'
      ? ((distance % length.value) + length.value) % length.value
      : Math.max(0, Math.min(length.value, distance));
  const p = guide.value.getPointAtLength(distance);
  anchor.value = { x: p.x, y: p.y };
}
watch(
  [
    content,
    preset,
    align,
    side,
    fontSize,
    letterSpacing,
    startOffset,
    pathOffset,
    points,
  ],
  redraw,
  { deep: true, flush: 'post' },
);

onMounted(async () => {
  const element = surface.value!;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  element.width = width * dpr;
  element.height = height * dpr;
  try {
    const instance = await new Canvas({
      canvas: element,
      devicePixelRatio: dpr,
      checkboardStyle: CheckboardStyle.NONE,
      theme: Theme.LIGHT,
      themeColors: {
        [Theme.LIGHT]: {
          background: '#fafaff',
          grid: '#fafaff',
          selectionBrushFill: '#dbeafe',
          selectionBrushStroke: '#2563eb',
        },
      },
    }).initialized;
    if (disposed) {
      instance.destroy();
      return;
    }
    canvas = instance;
    text = new Text({
      fill: '#6d28d9',
      fontFamily: 'sans-serif',
      fontSize: fontSize.value,
    });
    canvas.appendChild(text);
    ready.value = true;
    redraw();
  } catch (cause) {
    if (!disposed) error.value = String(cause);
  }
});
onBeforeUnmount(() => {
  disposed = true;
  drag = undefined;
  canvas?.destroy();
});

function localPoint(event: PointerEvent) {
  return new DOMPoint(event.clientX, event.clientY).matrixTransform(
    overlay.value!.getScreenCTM()!.inverse(),
  );
}
function project(p: DOMPoint) {
  const curve = guide.value!;
  const step = length.value / 160;
  const squared = (d: number) => {
    const q = curve.getPointAtLength(d);
    return (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
  };
  let nearest = 0,
    best = Infinity;
  for (let i = 0; i <= 160; i++) {
    const d = i * step,
      candidate = squared(d);
    if (candidate < best) {
      nearest = d;
      best = candidate;
    }
  }
  let lo = Math.max(0, nearest - step),
    hi = Math.min(length.value, nearest + step);
  for (let i = 0; i < 14; i++) {
    const a = lo + (hi - lo) / 3,
      b = hi - (hi - lo) / 3;
    if (squared(a) < squared(b)) hi = b;
    else lo = a;
  }
  return (lo + hi) / 2;
}
function begin(event: PointerEvent, point?: number) {
  if (!ready.value || event.button !== 0 || drag) return;
  event.preventDefault();
  drag = {
    id: event.pointerId,
    point,
    previous: project(localPoint(event)),
    offset: startOffset.value,
    points: points.value.map((p) => ({ ...p })),
  };
  overlay.value!.setPointerCapture(event.pointerId);
  (event.currentTarget as SVGElement).focus();
}
function move(event: PointerEvent) {
  if (!drag || drag.id !== event.pointerId) return;
  const p = localPoint(event);
  if (drag.point !== undefined) {
    points.value[drag.point] = {
      x: Math.max(8, Math.min(width - 8, p.x)),
      y: Math.max(8, Math.min(height - 8, p.y)),
    };
  } else {
    const next = project(p);
    let delta = next - drag.previous;
    if (preset.value === 'circle') {
      if (delta > length.value / 2) delta -= length.value;
      if (delta < -length.value / 2) delta += length.value;
    }
    startOffset.value += (side.value === 'right' ? -1 : 1) * delta;
    drag.previous = next;
  }
}
function end(event?: PointerEvent, cancel = false) {
  if (!drag || (event && event.pointerId !== drag.id)) return;
  const current = drag;
  drag = undefined;
  if (cancel) {
    points.value = current.points;
    startOffset.value = current.offset;
  }
  if (overlay.value?.hasPointerCapture(current.id))
    overlay.value.releasePointerCapture(current.id);
}
function key(event: KeyboardEvent, point?: number) {
  if (event.key === 'Escape') {
    end(undefined, true);
    event.preventDefault();
    return;
  }
  const directions: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  const direction = directions[event.key];
  if (!direction || !ready.value) return;
  event.preventDefault();
  const step = event.shiftKey ? 10 : 2;
  if (point === undefined)
    startOffset.value += (direction[0] || direction[1]) * step;
  else
    points.value[point] = {
      x: points.value[point].x + direction[0] * step,
      y: points.value[point].y + direction[1] * step,
    };
}
</script>

<template>
  <section class="text-path-demo" data-testid="text-path-demo">
    <div class="controls">
      <label class="content"
        >{{ words.text
        }}<input v-model="content" :aria-label="words.text" type="text"
      /></label>
      <label
        >{{ words.path
        }}<select
          v-model="preset"
          :aria-label="words.path"
          @change="startOffset = 0"
        >
          <option value="curve">{{ words.curve }}</option>
          <option value="circle">{{ words.circle }}</option>
          <option value="line">{{ words.line }}</option>
        </select></label
      >
      <label
        >{{ words.align
        }}<select v-model="align" :aria-label="words.align">
          <option value="start">{{ words.start }}</option>
          <option value="center">{{ words.center }}</option>
          <option value="end">{{ words.end }}</option>
        </select></label
      >
      <label
        >{{ words.side
        }}<select v-model="side" :aria-label="words.side">
          <option value="left">{{ words.left }}</option>
          <option value="right">{{ words.right }}</option>
        </select></label
      >
      <label
        >{{ words.size }}
        <span class="value" aria-hidden="true">{{ fontSize }}</span
        ><input
          v-model.number="fontSize"
          :aria-label="words.size"
          type="range"
          min="12"
          max="52"
      /></label>
      <label
        >{{ words.spacing }}
        <span class="value" aria-hidden="true">{{ letterSpacing }}</span
        ><input
          v-model.number="letterSpacing"
          :aria-label="words.spacing"
          type="range"
          min="-2"
          max="10"
          step="0.5"
      /></label>
      <label
        >{{ words.offset }}
        <span class="value" aria-hidden="true">{{
          Math.round(startOffset)
        }}</span
        ><input
          v-model.number="startOffset"
          :aria-label="words.offset"
          type="range"
          :min="-length"
          :max="length"
          step="any"
      /></label>
      <label
        >{{ words.normal }}
        <span class="value" aria-hidden="true">{{ pathOffset }}</span
        ><input
          v-model.number="pathOffset"
          :aria-label="words.normal"
          type="range"
          min="-45"
          max="45"
          step="1"
      /></label>
    </div>
    <div class="stage">
      <canvas
        ref="surface"
        :width="width"
        :height="height"
        aria-hidden="true"
      ></canvas>
      <svg
        ref="overlay"
        :viewBox="`0 0 ${width} ${height}`"
        @pointermove="move"
        @pointerup="end($event)"
        @pointercancel="end($event, true)"
        @lostpointercapture="end($event, true)"
        @keydown.esc.prevent="end(undefined, true)"
      >
        <path
          ref="guide"
          :d="path"
          fill="none"
          stroke="#94a3b8"
          stroke-width="1.5"
        />
        <rect
          v-if="ready && bounds.width"
          v-bind="bounds"
          fill="transparent"
          :stroke="showBounds ? '#93c5fd' : 'none'"
          stroke-dasharray="4 4"
          class="drag"
          @pointerdown="begin($event)"
        />
        <g v-if="preset === 'curve'" stroke="#f59e0b" stroke-width="1.5">
          <path
            :d="`M${points[0].x} ${points[0].y}L${points[1].x} ${points[1].y}M${points[2].x} ${points[2].y}L${points[3].x} ${points[3].y}`"
            opacity="0.55"
          />
          <circle
            v-for="(p, i) in points"
            :key="i"
            :cx="p.x"
            :cy="p.y"
            r="8"
            fill="#fffbeb"
            class="handle"
            role="button"
            tabindex="0"
            :aria-label="`${words.point} ${i + 1}`"
            @pointerdown="begin($event, i)"
            @keydown="key($event, i)"
          />
        </g>
        <circle
          v-if="ready"
          :cx="anchor.x"
          :cy="anchor.y"
          r="9"
          fill="#2563eb"
          stroke="white"
          stroke-width="2"
          class="handle"
          role="button"
          tabindex="0"
          :aria-label="words.move"
          @pointerdown="begin($event)"
          @keydown="key($event)"
        />
      </svg>
    </div>
    <div class="footer">
      <label
        ><input v-model="showBounds" type="checkbox" />
        {{ words.bounds }}</label
      ><span role="status">{{
        error || (ready ? words.ready : words.loading)
      }}</span>
    </div>
    <p class="hint">{{ words.hint }}</p>
  </section>
</template>

<style scoped>
.text-path-demo {
  margin: 1.5rem 0;
  border: 1px solid var(--vp-c-divider, #e2e8f0);
  border-radius: 12px;
  overflow: hidden;
}
.controls {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  padding: 16px;
}
.controls label {
  font-size: 12px;
  line-height: 1.6;
}
.controls .content {
  grid-column: span 4;
}
input[type='text'],
select {
  display: block;
  width: 100%;
  border: 1px solid var(--vp-c-divider, #cbd5e1);
  border-radius: 5px;
  padding: 5px 8px;
  font: inherit;
  background: var(--vp-c-bg, white);
}
input[type='range'] {
  display: block;
  width: 100%;
  accent-color: #7c3aed;
}
.value {
  float: right;
  font-variant-numeric: tabular-nums;
}
.stage {
  position: relative;
  touch-action: none;
  aspect-ratio: 600 / 320;
  background: #fafaff;
}
.stage canvas,
.stage svg {
  position: absolute;
  width: 100%;
  height: 100%;
  display: block;
}
.stage canvas {
  pointer-events: none;
}
.handle,
.drag {
  cursor: grab;
  touch-action: none;
}
.handle:focus {
  outline: none;
  stroke: #1e40af;
  stroke-width: 3px;
}
.footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px 0;
  font-size: 12px;
}
.hint {
  padding: 8px 16px 16px;
  margin: 0;
  font-size: 12px;
  color: var(--vp-c-text-2, #64748b);
}
@media (max-width: 520px) {
  .controls {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .controls .content {
    grid-column: span 2;
  }
}
</style>
