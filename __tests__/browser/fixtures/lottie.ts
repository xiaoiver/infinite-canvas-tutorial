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
import lottie from 'lottie-web';
import { loadAnimation } from '../../../packages/plugin-lottie/src';

const actual = document.querySelector<HTMLCanvasElement>('#actual')!;
const reference = document.querySelector<HTMLDivElement>('#reference')!;
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
      width: 256,
      height: 128,
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

const property = (k: unknown) => ({ a: 0, k });
const linear = (from: number[], to: number[]) => ({
  a: 1,
  k: [
    { t: 0, s: from, e: to, i: { x: [1], y: [1] }, o: { x: [0], y: [0] } },
    { t: 60, s: to },
  ],
});
export type LottieCase = {
  kind: 'move' | 'trim';
  start?: number;
  end?: number;
  offset?: number;
  round?: boolean;
  animated?: boolean;
  dashed?: boolean;
};
function fixture(options: LottieCase) {
  const ks = {
    o: property(100),
    r: property(0),
    p:
      options.kind === 'move'
        ? linear([40, 64, 0], [210, 64, 0])
        : property([0, 0, 0]),
    a: property([0, 0, 0]),
    s: property([100, 100, 100]),
  };
  const shapes =
    options.kind === 'move'
      ? [
          {
            ty: 'rc',
            p: property([0, 0]),
            s: property([40, 40]),
            r: property(0),
          },
          { ty: 'fl', c: property([1, 0, 0, 1]), o: property(100), r: 1 },
        ]
      : [
          {
            ty: 'sh',
            ks: property({
              v: [
                [16, 64],
                [240, 64],
              ],
              i: [
                [0, 0],
                [0, 0],
              ],
              o: [
                [0, 0],
                [0, 0],
              ],
              c: false,
            }),
          },
          {
            ty: 'st',
            c: property([1, 0, 0, 1]),
            o: property(100),
            w: property(12),
            lc: options.round ? 2 : 1,
            lj: 1,
            ml: 4,
            ...(options.dashed
              ? {
                  d: [
                    { n: 'd', v: property(12) },
                    { n: 'g', v: property(12) },
                  ],
                }
              : {}),
          },
          {
            ty: 'tm',
            s: property(options.start ?? 0),
            e: options.animated
              ? linear([25], [100])
              : property(options.end ?? 100),
            o: property(options.offset ?? 0),
            m: 1,
          },
        ];
  return {
    v: '5.13.0',
    fr: 60,
    ip: 0,
    op: 61,
    w: 256,
    h: 128,
    nm: 'regression',
    ddd: 0,
    assets: [],
    layers: [
      {
        ty: 4,
        ind: 1,
        nm: 'shape',
        ddd: 0,
        sr: 1,
        st: 0,
        ip: 0,
        op: 61,
        ks,
        shapes,
        ao: 0,
      },
    ],
  };
}
let animation: ReturnType<typeof loadAnimation> | undefined;
let referenceAnimation: ReturnType<typeof lottie.loadAnimation> | undefined;
const rendered = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
const probe = {
  api: () => api,
  animation: () => animation!,
  rendered,
  async load(options: LottieCase) {
    await animation?.destroy();
    referenceAnimation?.destroy();
    const data = fixture(options);
    const original = JSON.stringify(data);
    animation = loadAnimation(data as Parameters<typeof loadAnimation>[0], {
      loop: false,
      autoplay: false,
    });
    if (JSON.stringify(data) !== original)
      throw new Error('Import mutated the input');
    referenceAnimation = lottie.loadAnimation<'canvas'>({
      container: reference,
      animationData: structuredClone(data),
      renderer: 'canvas',
      loop: false,
      autoplay: false,
      rendererSettings: {
        clearCanvas: true,
        dpr: 1,
      },
    });
    await new Promise<void>((resolve) => {
      if (referenceAnimation!.isLoaded) resolve();
      else referenceAnimation!.addEventListener('DOMLoaded', () => resolve());
    });
    await api.edit(() => animation!.render(api));
    await probe.seek(0);
  },
  async seek(frame: number) {
    animation!.pause();
    animation!.goTo(frame, true);
    referenceAnimation!.goToAndStop(frame, true);
    await rendered();
    return [actual.toDataURL(), reference.querySelector('canvas')!.toDataURL()];
  },
};
declare global {
  interface Window {
    lottieTest: typeof probe;
  }
}
window.lottieTest = probe;
await app.run();
document.querySelector('#status')!.textContent = 'Ready';
