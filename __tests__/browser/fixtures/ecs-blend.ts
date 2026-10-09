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
} from '@infinite-canvas-tutorial/ecs';
import { NodeLayerBlendMode, Text } from '@infinite-canvas-tutorial/ecs';
import type { FillLayerBlendMode } from '../../../packages/ecs/src/types/fill-layer-blend';
import { toCSSMixBlendMode } from '../../../packages/ecs/src/utils/blend-mode';
import { settleECSFrames } from './ecs-frames';

const actual = document.querySelector<HTMLCanvasElement>('#actual')!;
const reference = document.querySelector<HTMLCanvasElement>('#reference')!;
let api: API;
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
        NodeLayerBlendMode,
        Text,
      ).write,
  );
  initialize() {
    api = new API(new DefaultStateManagement(), new Commands(this));
    api.createCanvas({
      element: actual,
      width: 320,
      height: 160,
      devicePixelRatio: 1,
    });
    api.createCamera({ zoom: 0.5 });
    api.setAppState({
      checkboardStyle: CheckboardStyle.NONE,
      theme: {
        mode: ThemeMode.LIGHT,
        colors: { light: { background: 'transparent' } },
      },
    });
  }
}
const app = new App().addPlugins(...DefaultPlugins, () => {
  system(PreStartUp)(Bootstrap);
  system((s) => s.before(ComputeZIndex))(Bootstrap);
});

export const modes: FillLayerBlendMode[] = [
  'normal',
  'darken',
  'multiply',
  'linearBurn',
  'colorBurn',
  'light',
  'screen',
  'linearDodge',
  'colorDodge',
  'overlay',
  'softLight',
  'hardLight',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity',
];
export interface BlendCase {
  kind?: 'node' | 'fill' | 'path';
  backdrop: string;
  source: string;
  opacity?: number;
}
const rendered = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
const probe = {
  api: () => api,
  settle: () => settleECSFrames(api, 12),
  async render(options: BlendCase) {
    const { backdrop, source, opacity = 1, kind = 'node' } = options;
    const ctx = reference.getContext('2d')!;
    ctx.setTransform(0.5, 0, 0, 0.5, 0, 0);
    ctx.clearRect(0, 0, 640, 320);
    const nodes: SerializedNode[] = [];
    modes.forEach((mode, i) => {
      const x = (i % 6) * 100 + 10,
        y = Math.floor(i / 6) * 100 + 10;
      const bottom: SerializedNode = {
        id: `bottom-${i}`,
        type: 'rect',
        x,
        y,
        width: 80,
        height: 80,
        zIndex: i * 2,
        fills: [{ type: 'solid', value: backdrop }],
      };
      const top: SerializedNode = {
        id: `top-${i}`,
        type: 'rect',
        x: x + 20,
        y: y + 20,
        width: 60,
        height: 60,
        zIndex: i * 2 + 1,
        fills: [{ type: 'solid', value: source }],
        opacity,
        blendMode: mode,
      };
      if (kind === 'fill') {
        nodes.push({
          ...bottom,
          fills: [
            { type: 'solid', value: backdrop },
            { type: 'solid', value: source, opacity, blendMode: mode },
          ],
        });
      } else {
        if (kind === 'path')
          Object.assign(top, {
            type: 'path',
            x: 0,
            y: 0,
            d: `M${x + 20} ${y + 20}h60v60h-60Z`,
            strokes: [{ type: 'solid', value: '#ffc040' }],
            strokeWidth: 16,
          });
        nodes.push(bottom, top);
      }
      const layer = document.createElement('canvas');
      layer.width = 80;
      layer.height = 80;
      const c = layer.getContext('2d')!;
      c.fillStyle = backdrop;
      c.fillRect(0, 0, 80, 80);
      c.globalCompositeOperation =
        (toCSSMixBlendMode(mode) as GlobalCompositeOperation) || 'source-over';
      c.globalAlpha = opacity;
      const paint = document.createElement('canvas');
      paint.width = 80;
      paint.height = 80;
      const pc = paint.getContext('2d')!;
      pc.fillStyle = source;
      pc.fillRect(
        kind === 'fill' ? 0 : 20,
        kind === 'fill' ? 0 : 20,
        kind === 'fill' ? 80 : 60,
        kind === 'fill' ? 80 : 60,
      );
      if (kind === 'path') {
        pc.strokeStyle = '#ffc040';
        pc.lineWidth = 16;
        pc.strokeRect(20, 20, 60, 60);
      }
      if (mode === 'linearBurn' || mode === 'linearDodge') {
        const b = c.getImageData(0, 0, 80, 80),
          s = pc.getImageData(0, 0, 80, 80);
        for (let j = 0; j < b.data.length; j += 4) {
          const ab = b.data[j + 3] / 255,
            as = (s.data[j + 3] / 255) * opacity;
          const ao = as + ab * (1 - as);
          for (let k = 0; k < 3; k++) {
            const cb = b.data[j + k] / 255,
              cs = s.data[j + k] / 255;
            const blend =
              mode === 'linearBurn'
                ? Math.max(0, cb + cs - 1)
                : Math.min(1, cb + cs);
            b.data[j + k] = ao
              ? (255 *
                  ((1 - as) * ab * cb + (1 - ab) * as * cs + as * ab * blend)) /
                ao
              : 0;
          }
          b.data[j + 3] = ao * 255;
        }
        c.putImageData(b, 0, 0);
      } else c.drawImage(paint, 0, 0);
      ctx.drawImage(layer, x, y);
    });
    // A normal continuation after blending must retain the offscreen backdrop.
    nodes.push({
      id: 'after-blends',
      type: 'rect',
      x: 620,
      y: 300,
      width: 10,
      height: 10,
      zIndex: 1000,
      fills: [{ type: 'solid', value: 'yellow' }],
    });
    ctx.fillStyle = 'yellow';
    ctx.fillRect(620, 300, 10, 10);
    await api.edit(() => {
      api.deleteNodesById(api.getNodes().map((n) => n.id));
      api.updateNodes(nodes);
    });
    await rendered();
  },
  async renderNodes(nodes: SerializedNode[]) {
    await api.edit(() => {
      api.deleteNodesById(api.getNodes().map((n) => n.id));
      api.updateNodes(nodes);
    });
    await rendered();
  },
  rendered,
};
declare global {
  interface Window {
    blendTest: typeof probe;
  }
}
window.blendTest = probe;
await app.run();
document.querySelector('#status')!.textContent = 'Ready';
