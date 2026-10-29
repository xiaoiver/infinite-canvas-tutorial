import './style.css';
import { createCardTextures, paintLandscape } from './cards';
import { createEngine, type Engine } from './engine';
import {
  accents,
  makeGraph,
  percentile,
  titles,
  visibleNodes,
  zoomAt,
  type Graph,
  type View,
  type WorkflowNode,
} from './graph';

const $ = <T extends HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const stage = $('#stage');
const canvas = $<HTMLCanvasElement>('#canvas');
const loading = $('#loading');
const scale = $<HTMLSelectElement>('#scale');
const minimap = $<HTMLCanvasElement>('#minimap');
const art = $<HTMLCanvasElement>('#inspector-art');
const graphLine = $<HTMLCanvasElement>('#sparkline');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const settings = new Map<
  string,
  {
    model: string;
    prompt: string;
    duration: string;
    ratio: string;
    motion: string;
  }
>();
let engine: Engine;
let graph: Graph = makeGraph(24);
let view: View = { x: 0, y: 0, zoom: 0.65 };
let selected: WorkflowNode | undefined;
let tool = 'select';
let space = false;
let busy = true;
let raf = 0;
let toastTimer = 0;
let tour: { start: number; original: View; sampleStart: number } | undefined;
let running = false;
let disposed = false;
let loadRevision = 0;
let runTimer = 0;
let previewTimer = 0;
let metricsStart = performance.now();
const benchmarkButton = $<HTMLButtonElement>('#benchmark');
const result = $('#benchmark-result');
const controls = ['#scale', '#add', '#layout', '#benchmark', '#run'];

function toast(message: string) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = window.setTimeout(() => {
    $('#toast').hidden = true;
  }, 3300);
}
function setBusy(value: boolean) {
  busy = value;
  controls.forEach((selector) => {
    $<HTMLButtonElement | HTMLSelectElement>(selector).disabled = value;
  });
}
function applyView(next: View) {
  view = next;
  engine.view(view);
  $('#zoom').textContent = `${Math.round(view.zoom * 100)}%`;
}
function focusFlow(pipeline = selected?.pipeline ?? 0) {
  const nodes = graph.nodes.filter((n) => n.pipeline === pipeline);
  if (!nodes.length) return;
  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxX = Math.max(...nodes.map((n) => n.x + n.width));
  const maxY = Math.max(...nodes.map((n) => n.y + n.height));
  const zoom = Math.max(
    0.2,
    Math.min(
      (stage.clientWidth - 75) / (maxX - minX),
      (stage.clientHeight - 330) / (maxY - minY),
      0.82,
    ),
  );
  applyView({ x: minX - 35 / zoom, y: minY - 190 / zoom, zoom });
}
function overview() {
  const zoom = Math.min(
    (stage.clientWidth - 100) / graph.width,
    (stage.clientHeight - 330) / graph.height,
    0.8,
  );
  applyView({ x: -50 / zoom, y: -180 / zoom, zoom });
}
function zoom(
  factor: number,
  x = stage.clientWidth / 2,
  y = stage.clientHeight / 2,
) {
  stopTour();
  applyView(zoomAt(view, view.zoom * factor, x, y));
}
function setTool(next: string) {
  tool = next;
  document
    .querySelectorAll<HTMLButtonElement>('[data-tool]')
    .forEach((button) => {
      const active = button.dataset.tool === tool;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  canvas.classList.toggle('hand', tool === 'hand' || space);
}
function selectNode(node?: WorkflowNode) {
  selected = node;
  void engine.select(node);
  if (!node) {
    $('#selection-id').textContent = 'NO SELECTION';
    return;
  }
  $('#selected-title').textContent = titles[node.kind];
  const descriptions = {
    prompt: '每一段旅程，都从一个念头开始。',
    reference: '为想象，寻找一束真实的光。',
    image: '让文字里的世界，成为眼前的画面。',
    motion: '从一张画面，到一个有呼吸的镜头。',
    grade: '以色彩，留住黄昏的温度。',
    output: '所有灵感，在这里汇成一部短片。',
  };
  const types = {
    prompt: 'CREATIVE DIRECTION',
    reference: 'IMAGE REFERENCE',
    image: 'IMAGE GENERATION',
    motion: 'VIDEO GENERATION',
    grade: 'COLOR GRADING',
    output: 'FINAL OUTPUT',
  };
  $('#selected-description').textContent = descriptions[node.kind];
  $('#selected-type').textContent = types[node.kind];
  $('#selected-icon').style.color = accents[node.kind];
  $('#scene-label').textContent = `${String(node.pipeline + 1).padStart(
    2,
    '0',
  )} — THE OPEN ROAD`;
  $('#selection-id').textContent = `NODE / ${String(
    graph.nodes.indexOf(node) + 1,
  ).padStart(3, '0')}`;
  $('#node-status').textContent = 'READY';
  const saved = settings.get(node.id);
  $<HTMLSelectElement>('#model').value = saved?.model ?? 'Kling 2.1';
  $<HTMLTextAreaElement>('#prompt').value =
    saved?.prompt ??
    '镜头缓缓向前推进，跟随公路上的车。落日余晖，轻微的胶片颗粒，安静而辽阔。';
  $<HTMLSelectElement>('#duration').value = saved?.duration ?? '8 秒';
  $<HTMLSelectElement>('#ratio').value = saved?.ratio ?? '16:9';
  $<HTMLInputElement>('#motion').value = saved?.motion ?? '65';
  updateMotion();
}
function updateMotion() {
  $('#motion-value').textContent = (
    Number($<HTMLInputElement>('#motion').value) / 100
  ).toFixed(2);
}
function stopTour(restore = false) {
  if (!tour) return;
  const original = tour.original;
  tour = undefined;
  benchmarkButton.textContent = '性能巡航 ↗';
  benchmarkButton.setAttribute('aria-pressed', 'false');
  if (restore) applyView(original);
}
async function load(count: number) {
  if (busy && engine) return;
  stopTour();
  setBusy(true);
  const revision = ++loadRevision;
  const start = performance.now();
  loading.hidden = false;
  loading.querySelector(
    'span',
  )!.textContent = `正在布置 ${count.toLocaleString()} 个节点…`;
  try {
    const next = makeGraph(count);
    // Hide the old overview behind the loading mask, then narrow the camera
    // before reclaiming it. Otherwise every deletion batch redraws thousands
    // of obsolete cards while the new scene is being prepared.
    focusFlow(0);
    await engine.load(next);
    if (disposed || revision !== loadRevision) return;
    graph = next;
    scale.value = String(count);
    if (!scale.value) {
      const option = new Option(
        `${count.toLocaleString()} 节点`,
        String(count),
      );
      scale.add(option);
      scale.value = String(count);
    }
    settings.clear();
    selectNode(graph.nodes[3] ?? graph.nodes[0]);
    focusFlow(0);
    $('#node-count').textContent = count.toLocaleString();
    $('#edge-count').textContent = graph.edges.length.toLocaleString();
    $('#minimap-count').textContent = `${Math.ceil(count / 6)} FLOWS`;
    result.hidden = true;
    metricsStart = performance.now() + 1500;
    $('#metrics-state').textContent = '引擎预热';
    toast(
      `${count.toLocaleString()} 个节点已就绪 · 场景提交 ${(
        performance.now() - start
      ).toFixed(0)} ms`,
    );
  } catch (error) {
    loading.classList.add('failed');
    loading.textContent = `场景加载失败：${
      error instanceof Error ? error.message : String(error)
    }`;
    throw error;
  } finally {
    if (!loading.classList.contains('failed')) loading.hidden = true;
    setBusy(false);
  }
}

function drawMinimap() {
  const ctx = minimap.getContext('2d')!;
  const width = minimap.width,
    height = minimap.height;
  ctx.clearRect(0, 0, width, height);
  const factor = Math.min(
    (width - 14) / graph.width,
    (height - 14) / graph.height,
  );
  ctx.save();
  ctx.translate(7, 7);
  ctx.scale(factor, factor);
  for (const node of graph.nodes) {
    ctx.fillStyle = selected?.id === node.id ? '#d5f1b5' : '#7e9b6888';
    ctx.fillRect(node.x, node.y, node.width, node.height);
  }
  ctx.fillStyle = '#c5ee9920';
  ctx.strokeStyle = '#c5ee99b0';
  ctx.lineWidth = 1 / factor;
  const x = Math.max(0, view.x),
    y = Math.max(0, view.y);
  const w = Math.max(
    0,
    Math.min(graph.width, view.x + stage.clientWidth / view.zoom) - x,
  );
  const h = Math.max(
    0,
    Math.min(graph.height, view.y + stage.clientHeight / view.zoom) - y,
  );
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}
function drawSparkline(values: number[]) {
  const ctx = graphLine.getContext('2d')!;
  const w = graphLine.width,
    h = graphLine.height;
  ctx.clearRect(0, 0, w, h);
  if (values.length < 2) return;
  const max = Math.max(20, ...values);
  ctx.strokeStyle = '#accb8640';
  ctx.lineWidth = 1;
  const threshold = h - (16.67 / max) * (h - 8) - 4;
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.moveTo(0, threshold);
  ctx.lineTo(w, threshold);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  values.forEach((value, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - (value / max) * (h - 8) - 4;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#bedf98';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
let lastMetrics = 0;
function tick() {
  const now = performance.now();
  if (disposed) return;
  if (tour) {
    const t = Math.min(1, (now - tour.start) / 10000);
    // Fixed, repeatable world-space camera path. It crosses loaded workflows
    // and varies visible density; manual navigation cancels immediately.
    const eased = t * t * (3 - 2 * t);
    const fullZoom = Math.min(
      (stage.clientWidth - 75) / graph.width,
      (stage.clientHeight - 150) / graph.height,
      0.18,
    );
    const targetZoom =
      fullZoom + (0.6 - fullZoom) * (0.5 + 0.5 * Math.cos(t * Math.PI * 4));
    const x = Math.max(0, graph.width - stage.clientWidth / targetZoom) * eased;
    const y =
      Math.max(0, graph.height - stage.clientHeight / targetZoom) *
      (0.5 - 0.5 * Math.cos(t * Math.PI * 2));
    applyView({ x, y, zoom: targetZoom });
    benchmarkButton.textContent = `巡航中 ${Math.ceil((1 - t) * 10)}s · 停止`;
    if (t === 1) {
      const measured = engine.samples.filter(
        (s) => s.completedAt >= tour!.sampleStart,
      );
      const fps = measured.length / ((now - tour.sampleStart) / 1000);
      const p95 = percentile(
        measured.map((s) => s.elapsed),
        0.95,
      );
      result.textContent = `${graph.nodes.length.toLocaleString()} 节点 · ${graph.edges.length.toLocaleString()} 连线 · ${(
        (now - tour.sampleStart) /
        1000
      ).toFixed(1)}s 巡航：${fps.toFixed(1)} FPS / P95 ${p95.toFixed(
        1,
      )} ms（本机实测）`;
      result.hidden = false;
      stopTour(true);
    }
  }
  if (now - lastMetrics > 400) {
    const windowStart = Math.max(metricsStart, now - 2000);
    const samples = engine.samples.filter((s) => s.completedAt >= windowStart);
    const seconds = (now - windowStart) / 1000;
    if (samples.length >= 2 && seconds > 0.3) {
      $('#fps').textContent = (samples.length / seconds).toFixed(0);
      $('#frame-time').textContent = percentile(
        samples.map((s) => s.elapsed),
        0.95,
      ).toFixed(1);
      $('#metrics-state').textContent = tour ? '自动巡航中' : '最近 2 秒';
      drawSparkline(samples.slice(-80).map((s) => s.elapsed));
    }
    $('#visible-count').textContent = visibleNodes(
      graph.nodes,
      view,
      stage.clientWidth,
      stage.clientHeight,
    ).length.toLocaleString();
    drawMinimap();
    lastMetrics = now;
  }
  raf = requestAnimationFrame(tick);
}

type Drag = {
  pointer: number;
  lastX: number;
  lastY: number;
  node?: WorkflowNode;
  moved: boolean;
  startX: number;
  startY: number;
};
let drag: Drag | undefined;
let pendingMove: WorkflowNode | undefined;
let moving = false;
async function flushMoves() {
  if (moving) return;
  moving = true;
  try {
    while (pendingMove && !disposed) {
      const node = { ...pendingMove };
      pendingMove = undefined;
      await engine.move(node);
    }
  } finally {
    moving = false;
  }
}
function pointerDown(event: PointerEvent) {
  event.stopImmediatePropagation();
  if (busy || (event.button !== 0 && event.button !== 1)) return;
  stopTour();
  canvas.focus({ preventScroll: true });
  canvas.setPointerCapture(event.pointerId);
  const bounds = canvas.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / view.zoom + view.x;
  const y = (event.clientY - bounds.top) / view.zoom + view.y;
  const node =
    !space && tool === 'select' && event.button === 0
      ? [...graph.nodes]
          .reverse()
          .find(
            (n) =>
              x >= n.x && y >= n.y && x <= n.x + n.width && y <= n.y + n.height,
          )
      : undefined;
  if (node) selectNode(node);
  drag = {
    pointer: event.pointerId,
    lastX: event.clientX,
    lastY: event.clientY,
    node,
    moved: false,
    startX: event.clientX,
    startY: event.clientY,
  };
  canvas.classList.add('dragging');
}
function pointerMove(event: PointerEvent) {
  event.stopImmediatePropagation();
  if (!drag || drag.pointer !== event.pointerId) return;
  const dx = (event.clientX - drag.lastX) / view.zoom,
    dy = (event.clientY - drag.lastY) / view.zoom;
  if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 3)
    drag.moved = true;
  drag.lastX = event.clientX;
  drag.lastY = event.clientY;
  if (drag.node) {
    drag.node.x += dx;
    drag.node.y += dy;
    pendingMove = drag.node;
    void flushMoves();
  } else applyView({ ...view, x: view.x - dx, y: view.y - dy });
}
function pointerUp(event: PointerEvent) {
  event.stopImmediatePropagation();
  if (drag?.pointer !== event.pointerId) return;
  if (
    event.type === 'pointerup' &&
    !drag.moved &&
    !drag.node &&
    tool === 'select' &&
    !space
  )
    selectNode();
  drag = undefined;
  canvas.classList.remove('dragging');
  if (canvas.hasPointerCapture(event.pointerId))
    canvas.releasePointerCapture(event.pointerId);
}
canvas.addEventListener('pointerdown', pointerDown, true);
canvas.addEventListener('pointermove', pointerMove, true);
canvas.addEventListener('pointerup', pointerUp, true);
canvas.addEventListener('pointercancel', pointerUp, true);
canvas.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (busy) return;
    const bounds = canvas.getBoundingClientRect();
    const delta =
      event.deltaY *
      (event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
        ? stage.clientHeight
        : 1);
    zoom(
      Math.exp(-Math.max(-100, Math.min(100, delta)) * 0.0025),
      event.clientX - bounds.left,
      event.clientY - bounds.top,
    );
  },
  { capture: true, passive: false },
);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener(
  'dblclick',
  (event) => {
    event.stopImmediatePropagation();
    if (!busy) focusFlow();
  },
  true,
);
minimap.addEventListener('pointerdown', (event) => {
  if (busy) return;
  stopTour();
  const bounds = minimap.getBoundingClientRect();
  const factor = Math.min(
    (minimap.width - 14) / graph.width,
    (minimap.height - 14) / graph.height,
  );
  const x =
    (((event.clientX - bounds.left) * minimap.width) / bounds.width - 7) /
    factor;
  const y =
    (((event.clientY - bounds.top) * minimap.height) / bounds.height - 7) /
    factor;
  applyView({
    ...view,
    x: x - stage.clientWidth / view.zoom / 2,
    y: y - stage.clientHeight / view.zoom / 2,
  });
});
const events = new AbortController();
window.addEventListener(
  'keydown',
  (event) => {
    if (
      event.target instanceof Element &&
      event.target.closest('input,textarea,select,button,dialog')
    )
      return;
    if (event.metaKey || event.ctrlKey || event.altKey || busy) return;
    const key = event.key.toLowerCase();
    if (key === ' ') {
      event.preventDefault();
      space = true;
      canvas.classList.add('hand');
    }
    if (key === 'v') setTool('select');
    if (key === 'h') setTool('hand');
    if (key === 'f') {
      stopTour();
      focusFlow();
    }
    if (key === '+' || key === '=') {
      event.preventDefault();
      zoom(1.2);
    }
    if (key === '-') {
      event.preventDefault();
      zoom(1 / 1.2);
    }
    if (key === 'escape') stopTour(true);
  },
  { signal: events.signal },
);
window.addEventListener(
  'keyup',
  (event) => {
    if (event.key === ' ') {
      space = false;
      setTool(tool);
    }
  },
  { signal: events.signal },
);
window.addEventListener(
  'blur',
  () => {
    space = false;
    setTool(tool);
    drag = undefined;
    canvas.classList.remove('dragging');
  },
  { signal: events.signal },
);
document.addEventListener(
  'visibilitychange',
  () => {
    metricsStart = performance.now();
    if (document.hidden && tour) {
      stopTour(true);
      toast('页面离开前台，已取消本次性能巡航。');
    }
  },
  { signal: events.signal },
);

document
  .querySelectorAll<HTMLButtonElement>('[data-tool]')
  .forEach((button) =>
    button.addEventListener('click', () => setTool(button.dataset.tool!)),
  );
$('#fit').onclick = () => {
  stopTour();
  focusFlow();
};
$('#overview').onclick = () => {
  stopTour();
  overview();
};
$('#zoom-in').onclick = () => zoom(1.2);
$('#zoom-out').onclick = () => zoom(1 / 1.2);
scale.onchange = () => {
  void load(Number(scale.value)).catch(reportError);
};
$('#layout').onclick = () => {
  void load(graph.nodes.length).catch(reportError);
};
$('#add').onclick = () => {
  if (graph.nodes.length >= 2400)
    return toast('已达到本示例的 2,400 节点上限。');
  void load(graph.nodes.length + 6)
    .then(() => {
      focusFlow(Math.ceil(graph.nodes.length / 6) - 1);
    })
    .catch(reportError);
};
$('#motion').oninput = updateMotion;
$('#apply').onclick = () => {
  if (!selected) return toast('先选择一个节点，再应用参数。');
  settings.set(selected.id, {
    model: $<HTMLSelectElement>('#model').value,
    prompt: $<HTMLTextAreaElement>('#prompt').value,
    duration: $<HTMLSelectElement>('#duration').value,
    ratio: $<HTMLSelectElement>('#ratio').value,
    motion: $<HTMLInputElement>('#motion').value,
  });
  toast('节点参数已保存在当前演示会话中。');
};
$('#export').onclick = () => {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          version: 1,
          example: 'FRAME',
          nodes: graph.nodes,
          edges: graph.edges,
          settings: Object.fromEntries(settings),
          view,
        },
        null,
        2,
      ),
    ],
    { type: 'application/json' },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'frame-workflow.json';
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('工作流 JSON 已导出。');
};
benchmarkButton.onclick = () => {
  if (tour) {
    stopTour(true);
    return;
  }
  if (reducedMotion.matches) {
    toast('系统开启了减少动态效果；关闭后可运行相机巡航。');
    return;
  }
  result.hidden = true;
  const now = performance.now();
  tour = { start: now, original: { ...view }, sampleStart: now };
  benchmarkButton.setAttribute('aria-pressed', 'true');
};
$('#run').onclick = () => {
  if (running) return;
  running = true;
  const button = $<HTMLButtonElement>('#run');
  button.disabled = true;
  let step = 0;
  const pipeline = selected?.pipeline ?? 0;
  function next() {
    if (disposed) return;
    const node = graph.nodes.filter((n) => n.pipeline === pipeline)[step];
    if (!node) {
      running = false;
      button.disabled = false;
      button.innerHTML = '<span>▶</span> 演示运行';
      $('#node-status').textContent = 'COMPLETED';
      toast('流程演示完成 · 使用本地示例素材，未调用生成服务。');
      return;
    }
    selectNode(node);
    $('#node-status').textContent = 'DEMO RUNNING';
    button.textContent = `演示中 ${++step}/6`;
    runTimer = window.setTimeout(next, 650);
  }
  next();
};
$('#preview').onclick = () => {
  clearTimeout(previewTimer);
  const preview = $('.inspector-preview');
  const active = preview.classList.toggle('preview-playing');
  $('#preview').textContent = active ? 'Ⅱ' : '▶';
  if (active) {
    toast('镜头运动示意 · 本地静帧动画');
    previewTimer = window.setTimeout(() => {
      preview.classList.remove('preview-playing');
      $('#preview').textContent = '▶';
    }, 8000);
  }
};
const helpDialog = $<HTMLDialogElement>('#help-dialog');
$('#help').onclick = () => helpDialog.showModal();
$('#about').onclick = () => helpDialog.showModal();
$('#close-help').onclick = () => helpDialog.close();
$('#properties-tab').onclick = () => {
  if (selected) toast(`当前节点：${titles[selected.kind]}`);
};
function reportError(error: unknown) {
  console.error(error);
  toast(`操作失败：${error instanceof Error ? error.message : String(error)}`);
}
const resize = new ResizeObserver(() => {
  if (engine && !disposed)
    void engine.resize(stage.clientWidth, stage.clientHeight);
});
resize.observe(stage);
async function dispose() {
  if (disposed) return;
  disposed = true;
  ++loadRevision;
  cancelAnimationFrame(raf);
  clearTimeout(toastTimer);
  clearTimeout(runTimer);
  clearTimeout(previewTimer);
  resize.disconnect();
  events.abort();
  await engine?.dispose();
}
window.addEventListener(
  'pagehide',
  () => {
    void dispose();
  },
  { once: true },
);
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    void dispose();
  });

declare global {
  interface Window {
    workflowDemo: {
      connections(): ReturnType<Engine['connections']>;
      snapshot(): {
        nodes: number;
        edges: number;
        selected?: string;
        view: View;
        ready: boolean;
        frames: number;
        renderedNodes: number;
        renderedEdges: number;
        positions: { id: string; x: number; y: number }[];
      };
    };
  }
}
window.workflowDemo = {
  connections: () => engine?.connections() ?? [],
  snapshot: () => ({
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    selected: selected?.id,
    view: { ...view },
    ready: Boolean(engine) && !busy,
    frames: engine?.frameCount ?? 0,
    renderedNodes: engine?.counts().nodes ?? 0,
    renderedEdges: engine?.counts().edges ?? 0,
    positions: graph.nodes.slice(0, 6).map(({ id, x, y }) => ({ id, x, y })),
  }),
};
async function start() {
  paintLandscape(art.getContext('2d')!, 0, 0, art.width, art.height);
  engine = await createEngine(canvas, await createCardTextures());
  busy = false;
  await load(24);
  raf = requestAnimationFrame(tick);
}
void start().catch((error) => {
  loading.hidden = false;
  loading.classList.add('failed');
  loading.textContent = `画布启动失败。请确认浏览器支持 WebGL 2。\n${
    error instanceof Error ? error.message : String(error)
  }`;
  reportError(error);
});
