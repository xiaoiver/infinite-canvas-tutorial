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
} from '@infinite-canvas-tutorial/ecs';
import { SmoothPolyline } from '../../../packages/ecs/src/drawcalls/SmoothPolyline';
import { Mesh } from '../../../packages/ecs/src/drawcalls/Mesh';
import { settleECSFrames } from './ecs-frames';
import { installPathTest } from './path-rendering';
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
      width: 640,
      height: 320,
      devicePixelRatio:
        Number(new URLSearchParams(location.search).get('dpr')) || 1,
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

const stats = { builds: 0, vertices: 0 };
for (const ctor of [Mesh, SmoothPolyline]) {
  const original = ctor.prototype.createGeometry;
  ctor.prototype.createGeometry = function () {
    original.call(this);
    stats.builds++;
    stats.vertices =
      this instanceof Mesh
        ? this.points.length / 2
        : this.pointsBuffer.length / 3;
  };
}
await app.run();
installPathTest({
  async scene(options) {
    await api.edit(() => {
      api.deleteNodesById(['curve', 'parent']);
      api.updateNodes([
        {
          id: 'parent',
          type: 'g',
          zIndex: 0,
          scaleX: options.parentScale,
          scaleY: 1,
        },
        {
          id: 'curve',
          parentId: 'parent',
          type: 'path',
          zIndex: 0,
          d: options.d,
          fills: options.fill ? [{ type: 'solid', value: 'blue' }] : [],
          strokes: options.fill ? [] : [{ type: 'solid', value: 'blue' }],
          opacity: options.opacity ?? 1,
          strokeWidth: options.strokeWidth ?? 3,
          strokeLinejoin: options.lineJoin ?? 'round',
          strokeLinecap: 'butt',
        },
      ]);
    });
    await settleECSFrames(api);
  },
  async view(zoom, x, y) {
    await api.edit(() =>
      api.setAppState({ cameraZoom: zoom, cameraX: x, cameraY: y }),
    );
    await settleECSFrames(api);
  },
  bounds() {
    const { minX, minY, maxX, maxY } = api.getGeometryBounds([
      api.getNodeById('curve')!,
    ]);
    return [minX, minY, maxX, maxY];
  },
  stats: () => ({ ...stats }),
});
