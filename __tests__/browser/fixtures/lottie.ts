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
  kind: 'move' | 'trim' | 'polystar' | 'repeater';
  start?: number;
  end?: number;
  offset?: number;
  round?: boolean;
  animated?: boolean;
  dashed?: boolean;
  polygon?: boolean;
  points?: number;
  direction?: number;
  roundness?: number;
  outerRadius?: number;
  innerRadius?: number;
  nested?: boolean;
  hold?: boolean;
  eased?: boolean;
  expression?: boolean;
  startFrame?: number;
  stroked?: boolean;
  animatedPaint?: boolean;
  copies?: number;
  composite?: 1 | 2;
  repeatPosition?: number[];
  repeatScale?: number[];
  repeatRotation?: number;
  repeatAnchor?: number[];
  opacityStart?: number;
  opacityEnd?: number;
  nestedRepeater?: boolean;
  outerPaint?: boolean;
  repeatedStar?: boolean;
  layerOpacity?: number;
  animatedLayerOpacity?: boolean;
};
function repeaterShapes(options: LottieCase) {
  const paint = (color: number[]) => ({
    ty: 'fl',
    c: property(color),
    o: options.animatedPaint ? linear([100], [50]) : property(100),
    r: 1,
  });
  const box = (p: number[], size: number[], color: number[]) => ({
    ty: 'gr',
    it: [
      { ty: 'rc', p: property(p), s: property(size), r: property(0) },
      ...(!options.outerPaint ? [paint(color)] : []),
    ],
  });
  const repeated = options.repeatedStar
    ? [
        {
          ty: 'gr',
          it: [
            {
              ty: 'sr',
              sy: 1,
              pt: property(5),
              p: property([25, 30]),
              r: linear([0], [180]),
              or: property(12),
              os: property(0),
              ir: property(6),
              is: property(0),
            },
            paint([1, 0, 0, 1]),
          ],
        },
      ]
    : [
        box([25, 35], [22, 24], [1, 0, 0, 1]),
        box([30, 30], [18, 14], [0, 0, 1, 1]),
      ];
  const copies = options.animated
    ? linear([0], [5])
    : property(options.copies ?? 4);
  if (options.hold && options.animated) Object.assign(copies.k[0], { h: 1 });
  if (options.eased && options.animated) {
    copies.k[0].o = { x: [0.3], y: [1.8] };
    copies.k[0].i = { x: [0.7], y: [1.8] };
  }
  if (options.expression)
    Object.assign(copies, { x: 'var $bm_rt; $bm_rt = 3 + time * 2;' });
  const repeater = {
    ty: 'rp',
    c: copies,
    o: options.animated ? linear([-0.5], [1.5]) : property(options.offset ?? 0),
    m: options.composite ?? 1,
    tr: {
      p: options.animated
        ? linear([35, 3], [40, 10])
        : property(options.repeatPosition ?? [40, 10]),
      a: property(options.repeatAnchor ?? [20, 30]),
      s: options.animated
        ? linear([100, 100], [85, 110])
        : property(options.repeatScale ?? [100, 100]),
      r: options.animated
        ? linear([0], [12])
        : property(options.repeatRotation ?? 0),
      so: options.animated
        ? linear([100], [70])
        : property(options.opacityStart ?? 100),
      eo: options.animated
        ? linear([80], [100])
        : property(options.opacityEnd ?? 100),
    },
  };
  const shapes = [...repeated, repeater];
  if (options.nestedRepeater)
    shapes.splice(0, shapes.length, { ty: 'gr', it: [...shapes] } as any, {
      ...repeater,
      c: property(2),
      o: property(0),
      tr: {
        ...repeater.tr,
        p: property([0, 48]),
        r: property(0),
        s: property([100, 100]),
      },
    });
  if (options.outerPaint) shapes.push(paint([1, 0, 0, 1]) as any);
  return options.nested
    ? [
        {
          ty: 'gr',
          it: [
            ...shapes,
            {
              ty: 'tr',
              p: property([5, 5]),
              a: property([3, 2]),
              r: property(5),
              s: property([90, 90]),
              o: property(80),
            },
          ],
        },
      ]
    : shapes;
}
function polystarShapes(options: LottieCase) {
  const animate = (from: number[], to: number[]) => {
    const property = linear(from, to);
    if (options.eased) {
      property.k[0].o = { x: [0.42], y: [0] };
      property.k[0].i = { x: [1], y: [1] };
    }
    return options.hold
      ? { ...property, k: [{ ...property.k[0], h: 1 }, property.k[1]] }
      : property;
  };
  const shapes = [
    {
      ty: 'sr',
      sy: options.polygon ? 2 : 1,
      d: options.direction ?? 1,
      pt: options.animated ? animate([4], [8]) : property(options.points ?? 5),
      p: options.animated ? animate([100, 64], [150, 60]) : property([128, 64]),
      r: options.expression
        ? { ...property(0), x: 'var $bm_rt; $bm_rt = time * 120;' }
        : options.animated
        ? animate([0], [270])
        : property(17),
      or: options.animated
        ? animate([36], [48])
        : property(options.outerRadius ?? 50),
      os: options.animated
        ? animate([0], [80])
        : property(options.roundness ?? 0),
      ir: options.animated
        ? animate([12], [24])
        : property(options.innerRadius ?? 23),
      is: options.animated
        ? animate([60], [0])
        : property(options.roundness ?? 0),
    },
    ...(options.stroked
      ? [
          {
            ty: 'st',
            c: property([1, 0, 0, 1]),
            o: property(100),
            w: options.animatedPaint ? linear([3], [8]) : property(5),
            lc: 2,
            lj: 2,
            ml: 4,
          },
        ]
      : [
          {
            ty: 'fl',
            c: property([1, 0, 0, 1]),
            o: options.animatedPaint ? linear([100], [40]) : property(100),
            r: 1,
          },
        ]),
  ];
  return options.nested
    ? [
        {
          ty: 'gr',
          it: [
            ...shapes,
            {
              ty: 'tr',
              p: property([8, 3]),
              a: property([0, 0]),
              s: property([90, 85]),
              r: property(5),
              o: property(100),
            },
          ],
        },
      ]
    : shapes;
}
function fixture(options: LottieCase) {
  const ks = {
    o: options.animatedLayerOpacity
      ? linear([100], [60])
      : property(options.layerOpacity ?? 100),
    r: property(0),
    p:
      options.kind === 'move'
        ? linear([40, 64, 0], [210, 64, 0])
        : property([0, 0, 0]),
    a: property([0, 0, 0]),
    s: property([100, 100, 100]),
  };
  const shapes =
    options.kind === 'repeater'
      ? repeaterShapes(options)
      : options.kind === 'polystar'
      ? polystarShapes(options)
      : options.kind === 'move'
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
    ip: options.startFrame ?? 0,
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
        ip: options.startFrame ?? 0,
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
