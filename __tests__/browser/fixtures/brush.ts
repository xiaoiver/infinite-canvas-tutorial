import {
  API,
  Pen,
  Brush,
  BrushType,
  Transformable,
  Input,
  UI,
  type BrushSerializedNode,
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
import { settleECSFrames } from './ecs-frames';
import stampUrl from '../../../packages/site/docs/public/stamp1.png?url';

const actual = document.querySelector<HTMLCanvasElement>('#actual')!;
let api: API;
class Bootstrap extends System {
  access = this.query(
    (q) =>
      q.using(
        Brush,
        Input,
        UI,
        Transformable,
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
      width: 640,
      height: 320,
      svgLayer: document.querySelector<HTMLDivElement>('#overlay')!,
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

const settle = () => settleECSFrames(api, 4);
const probe = {
  api: () => api,
  settle,
  nodes: () =>
    api
      .getNodes()
      .filter(
        (n): n is BrushSerializedNode =>
          n.type === 'brush' && n.visibility !== 'hidden',
      ),
  previews: () =>
    api
      .getCamera()
      .read(Parent)
      .children.filter(
        (entity) =>
          entity.has(Brush) &&
          entity.has(UI) &&
          entity.read(Visibility).value === 'visible',
      )
      .map((entity) => entity.read(Brush).points.map((p) => ({ ...p }))),
  async activate(zoom = 1, brushType = BrushType.VANILLA) {
    await api.edit(
      () => {
        api.deselectNodes(api.getNodes());
        api.setAppState({
          penbarSelected: Pen.BRUSH,
          snapToObjectsEnabled: false,
          snapToPixelGridEnabled: false,
          penbarBrush: {
            ...api.getAppState().penbarBrush,
            brushType,
            stamps:
              brushType === BrushType.STAMP
                ? [
                    {
                      src: stampUrl,
                      preview: stampUrl,
                      name: 'Test stamp',
                      active: true,
                    },
                  ]
                : [],
            strokeWidth: 20,
            strokes: [{ type: 'solid', value: '#000000' }],
            stampNoiseFactor: 0,
            stampRotationFactor: 0,
          },
        });
        api.gotoLandmark(api.createLandmark({ x: 0, y: 0, zoom }), {
          duration: 0,
        });
      },
      { capture: 'NEVER' },
    );
    await settle();
  },
  async undo() {
    await api.undo();
    await settle();
  },
  async redo() {
    await api.redo();
    await settle();
  },
  async stamp() {
    await probe.activate(1, BrushType.STAMP);
  },
  destroy: () => app.exit(),
};
declare global {
  interface Window {
    brushTest: typeof probe;
  }
}
window.brushTest = probe;
await app.run();
await settle();
await probe.activate();
document.querySelector('#status')!.textContent = 'Ready';
