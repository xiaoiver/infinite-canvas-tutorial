import {
  API,
  TesselationMethod,
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
} from '@infinite-canvas-tutorial/ecs';
import { settleECSFrames } from './ecs-frames';
const actual = document.querySelector<HTMLCanvasElement>('#actual')!;
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
      ).write,
  );
  initialize() {
    api = new API(new DefaultStateManagement(), new Commands(this));
    api.createCanvas({
      element: actual,
      width: 400,
      height: 180,
      devicePixelRatio: 1,
    });
    api.createCamera({ zoom: 1 });
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

import { createSolidFillMaskRasterForFilter } from '../../../packages/ecs/src/utils/solidShapeRasterForFilter';
import type { Entity, SerializedNode } from '@infinite-canvas-tutorial/ecs';

export interface FillCase {
  d: string;
  rule: CanvasFillRule;
  method?: 'earcut' | 'libtess';
  mirror?: boolean;
  secondRule?: CanvasFillRule;
}
const reference = document.querySelector<HTMLCanvasElement>('#reference')!;
const mask = document.querySelector<HTMLCanvasElement>('#mask')!;
await app.run();
let current: FillCase;
async function render(options: FillCase, update = false) {
  current = options;
  const rules = [options.rule, options.secondRule].filter(
    Boolean,
  ) as CanvasFillRule[];
  const nodes: SerializedNode[] = rules.flatMap((rule, i) => [
    {
      id: `group-${i}`,
      type: 'g',
      zIndex: i * 2,
      x: i * 200 + (options.mirror ? 180 : 0),
      scaleX: options.mirror ? -1 : 1,
    },
    {
      id: `path-${i}`,
      parentId: `group-${i}`,
      type: 'path',
      x: 0,
      y: 0,
      zIndex: i * 2 + 1,
      d: options.d,
      fillRule: rule,
      tessellationMethod:
        options.method === 'libtess'
          ? TesselationMethod.LIBTESS
          : TesselationMethod.EARCUT,
      fills: [{ type: 'solid', value: 'rgba(0,0,255,0.5)' }],
      strokes: [],
    },
  ]);
  await api.edit(() => {
    if (!update)
      api.deleteNodesById(['path-0', 'path-1', 'group-0', 'group-1']);
    api.updateNodes(nodes);
  });
  await settleECSFrames(api);
  for (const canvas of [reference, mask]) {
    const ctx = canvas.getContext('2d')!;
    ctx.resetTransform();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    rules.forEach((rule, i) => {
      ctx.setTransform(
        options.mirror ? -1 : 1,
        0,
        0,
        1,
        i * 200 + (options.mirror ? 180 : 0),
        0,
      );
      if (canvas === reference) {
        ctx.fillStyle = 'rgba(0,0,255,0.5)';
        ctx.fill(new Path2D(options.d), rule);
      } else {
        const shape = {
          has: (type: unknown) => type === Path,
          hasSomeOf: (...types: unknown[]) => types.includes(Path),
          read: () => ({ d: options.d, fillRule: rule }),
        } as unknown as Entity;
        const raster = createSolidFillMaskRasterForFilter(
          shape,
          'rgba(0,0,255,0.5)',
          { minX: 0, minY: 0, maxX: 180, maxY: 160 },
          180,
          160,
        );
        ctx.drawImage(raster, 0, 0);
      }
    });
  }
  return {
    method: api.getEntity(api.getNodeById('path-0')!).read(Path)
      .tessellationMethod,
    actual: actual.toDataURL(),
    reference: reference.toDataURL(),
    mask: mask.toDataURL(),
  };
}
const harness = {
  render,
  updateRule: (rule: CanvasFillRule) => render({ ...current, rule }, true),
  updateMethod: (method: FillCase['method']) =>
    render({ ...current, method }, true),
};
window.pathFillTest = harness;
declare global {
  interface Window {
    pathFillTest: typeof harness;
  }
}
document.querySelector('#status')!.textContent = 'Ready';
