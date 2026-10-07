import {
  API,
  App,
  Canvas,
  Theme,
  ThemeMode,
  Grid,
  Camera,
  Parent,
  Children,
  Transform,
  Renderable,
  FillLayers,
  StrokeLayers,
  Stroke,
  Rect,
  Polyline,
  Path,
  Visibility,
  Name,
  DropShadow,
  ZIndex,
  Opacity,
  GlobalTransform,
  VectorNetwork,
  Circle,
  Ellipse,
  Commands,
  ComputeZIndex,
  DefaultPlugins,
  DefaultStateManagement,
  PreStartUp,
  System,
  system,
  CheckboardStyle,
  StrokeAttenuation,
  type SerializedNode,
  type PolylineSerializedNode,
  type RectSerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { SmoothPolyline } from '../../../packages/ecs/src/drawcalls/SmoothPolyline';
import type { DashCase } from './dash';

export interface EcsDashCase extends DashCase {
  attenuation?: boolean;
  gradient?: boolean;
  linecap?: CanvasLineCap;
  kind?: 'path' | 'vector-network' | 'circle' | 'ellipse';
}

const actual = document.querySelector<HTMLCanvasElement>('#actual')!;
const reference = document.querySelector<HTMLCanvasElement>('#reference')!;
let api: API;
let builds = 0;
const createGeometry = SmoothPolyline.prototype.createGeometry;
SmoothPolyline.prototype.createGeometry = function () {
  builds++;
  return createGeometry.call(this);
};
class Bootstrap extends System {
  access = this.query(
    (q) =>
      q.using(
        Canvas,
        Theme,
        Grid,
        Camera,
        Parent,
        Children,
        Transform,
        Renderable,
        FillLayers,
        StrokeLayers,
        Stroke,
        Rect,
        Polyline,
        Path,
        Visibility,
        Name,
        DropShadow,
        ZIndex,
        Opacity,
        GlobalTransform,
        StrokeAttenuation,
        VectorNetwork,
        Circle,
        Ellipse,
      ).write,
  );
  initialize() {
    api = new API(new DefaultStateManagement(), new Commands(this));
    api.createCanvas({
      element: actual,
      width: 640,
      height: 320,
      devicePixelRatio: 1,
    });
    api.createCamera({ zoom: 1 });
    api.setAppState({
      checkboardStyle: CheckboardStyle.NONE,
      theme: {
        mode: ThemeMode.LIGHT,
        colors: { light: { background: '#ffffff' } },
      },
    });
  }
}
const app = new App().addPlugins(...DefaultPlugins, () => {
  system(PreStartUp)(Bootstrap);
  system((s) => s.before(ComputeZIndex))(Bootstrap);
});
let options: EcsDashCase;
// API.edit completes before rendering; two animation frames let the renderer
// consume the changed component data before taking a screenshot.
const rendered = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
function drawReference() {
  const {
    points,
    dash,
    offset = 0,
    width = 20,
    cap = 'butt',
    join = 'miter',
    zoom = 1,
    closed = false,
    alignment = 'center',
  } = options;
  const ctx = reference.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, 640, 320);
  ctx.scale(zoom, zoom);
  ctx.strokeStyle = 'black';
  const attenuation = options.attenuation ? zoom : 1;
  ctx.lineWidth = width / attenuation;
  ctx.lineJoin = join;
  ctx.lineCap = cap;
  ctx.setLineDash(dash.map((value) => value / attenuation));
  ctx.lineDashOffset = offset / attenuation;
  if (alignment !== 'center' && points.length === 2) {
    const dx = points[1][0] - points[0][0],
      dy = points[1][1] - points[0][1];
    const shift =
      (width * (alignment === 'outer' ? 0.5 : -0.5)) / Math.hypot(dx, dy);
    ctx.translate(dy * shift, -dx * shift);
  }
  ctx.beginPath();
  let start = true;
  points.forEach(([x, y]) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      start = true;
      return;
    }
    if (start) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    start = false;
  });
  if (closed) ctx.closePath();
  const independentCaps =
    options.linecap !== undefined && options.linecap !== cap;
  if (independentCaps) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(points[0][0], 0, points[1][0] - points[0][0], 320 / zoom);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    ctx.lineTo(...points[1]);
  }
  ctx.stroke();
  if (independentCaps) {
    ctx.restore();
    const radius = ctx.lineWidth / 2;
    const period = dash[0] + dash[1];
    points.forEach(([x, y], index) => {
      const phase =
        (((offset + (x - points[0][0]) * attenuation) % period) + period) %
        period;
      const painted =
        index === 0 ? phase < dash[0] : phase > 0 && phase <= dash[0];
      if (!painted || options.linecap === 'butt') return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(index === 0 ? x - radius : x, y - radius, radius, radius * 2);
      ctx.clip();
      ctx.fillStyle = 'black';
      if (options.linecap === 'round') {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      } else ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      ctx.restore();
    });
  }
}
window.dashTest = {
  geometryBuilds: () => builds,
  async offset(value) {
    options = { ...options, offset: value };
    await api.edit(() =>
      api.updateNodes([
        {
          ...(api.getNodeById('dash') as
            | PolylineSerializedNode
            | RectSerializedNode),
          strokeDashoffset: value,
        },
      ]),
    );
    drawReference();
    await rendered();
  },
  async render(next) {
    options = next;
    const {
      points,
      dash,
      offset = 0,
      width = 20,
      cap = 'butt',
      join = 'miter',
      zoom = 1,
      closed = false,
      alignment = 'center',
      rect = false,
    } = options;
    const pathPoints = closed ? [...points, points[0]] : points;
    const node: SerializedNode = {
      id: 'dash',
      type: 'polyline',
      zIndex: 0,
      points: pathPoints.map((p) => p.join(',')).join(' '),
      strokes: [
        {
          type: options.gradient ? 'gradient' : 'solid',
          value: options.gradient
            ? 'linear-gradient(90deg, #000000, #0000ff)'
            : 'black',
        },
      ],
      strokeWidth: width,
      strokeAlignment: alignment,
      strokeLinecap: options.linecap ?? cap,
      strokeLinejoin: join,
      strokeDashCap: cap === 'butt' ? 'none' : cap,
      strokeDasharray: dash.join(','),
      strokeDashoffset: offset,
      strokeAttenuation: options.attenuation ?? false,
    };
    if (rect)
      Object.assign(node, {
        type: 'rect',
        fills: [],
        x: points[0][0],
        y: points[0][1],
        width: points[2][0] - points[0][0],
        height: points[2][1] - points[0][1],
      });
    if (options.kind === 'path')
      Object.assign(node, {
        type: 'path',
        fills: [],
        d:
          points.map(([x, y], i) => `${i ? 'L' : 'M'} ${x} ${y}`).join(' ') +
          (closed ? ' Z' : ''),
      });
    if (options.kind === 'vector-network')
      Object.assign(node, {
        type: 'vector-network',
        fills: [],
        vertices: points.map(([x, y]) => ({ x, y })),
        segments: points.slice(1).map((_, i) => ({ start: i, end: i + 1 })),
      });
    if (options.kind === 'circle' || options.kind === 'ellipse') {
      const rx = options.kind === 'circle' ? 80 : 100;
      const ry = options.kind === 'circle' ? 80 : 60;
      Object.assign(node, {
        type: 'ellipse',
        fills: [],
        x: 150 - rx,
        y: 150 - ry,
        width: 2 * rx,
        height: 2 * ry,
      });
    }
    await api.edit(() => {
      api.deleteNodesById(['dash']);
      api.setAppState({ cameraZoom: zoom, cameraX: 0, cameraY: 0 });
      api.updateNodes([node]);
    });
    drawReference();
    await rendered();
  },
};
try {
  await app.run();
  document.querySelector('#status')!.textContent = 'Ready';
} catch (error) {
  document.querySelector('#status')!.textContent = String(error);
  throw error;
}
