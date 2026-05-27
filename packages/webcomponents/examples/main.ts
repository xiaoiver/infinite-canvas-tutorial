import {
  App,
  registerIconifyIconSet,
  svgElementsToSerializedNodes,
  svgSvgElementToComputedCamera,
  DefaultPlugins,
  Pen,
  Task,
  CheckboardStyle,
  BrushType,
  inferXYWidthHeight,
  StampMode,
  EdgeStyle,
  DefaultRendererPlugin,
  RendererPlugin,
  System,
  Commands,
  system,
  PreStartUp,
  ComputeZIndex,
  Screenshot,
  Canvas,
  Theme,
  Grid,
  Camera,
  Parent,
  Children,
  Transform,
  Renderable,
  Stroke,
  Rect,
  Visibility,
  Name,
  Opacity,
  ZIndex,
  Text,
  TextDecoration,
  Line,
  Plugin,
  ThemeMode,
  RectSerializedNode,
  TRANSFORMER_MASK_FILL_COLOR,
  TesselationMethod,
  SerializedNode,
  registerCubeLutFromText,
  GPUResource,
  DefaultRenderer3DPlugin,
  Camera3D,
  Mesh3D,
  Material3D,
  Transform3D,
} from '../../ecs';
import { Event, UIPlugin } from '../src';
import '../src/spectrum';
import { LaserPointerPlugin } from '../../plugin-laser-pointer/src';
import { EraserPlugin } from '../../plugin-eraser/src';
import { LassoPlugin } from '../../plugin-lasso/src';
import { FilterPlugin } from '@infinite-canvas-tutorial/filter';
import { YogaPlugin } from '../../plugin-yoga/src';
import { loadAnimation } from '../../plugin-lottie/src';
import { InitVello, VelloPipeline, registerFont } from '../../plugin-vello/src';
import '../../plugin-laser-pointer/src/spectrum';
import '../../plugin-eraser/src/spectrum';
import '../../plugin-lasso/src/spectrum';
import WebFont from 'webfontloader';

WebFont.load({
  google: {
    families: ['Gaegu'],
  },
});

/** Unit cube with per-face normals (24 verts, indexed). */
function createCubeGeometry(size = 1) {
  const h = size / 2;
  const faces: {
    normal: [number, number, number];
    verts: [number, number, number][];
  }[] = [
      { normal: [0, 0, 1], verts: [[-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]] },
      { normal: [0, 0, -1], verts: [[-h, -h, -h], [-h, h, -h], [h, h, -h], [h, -h, -h]] },
      { normal: [0, 1, 0], verts: [[-h, h, -h], [-h, h, h], [h, h, h], [h, h, -h]] },
      { normal: [0, -1, 0], verts: [[-h, -h, -h], [h, -h, -h], [h, -h, h], [-h, -h, h]] },
      { normal: [1, 0, 0], verts: [[h, -h, -h], [h, h, -h], [h, h, h], [h, -h, h]] },
      { normal: [-1, 0, 0], verts: [[-h, -h, -h], [-h, -h, h], [-h, h, h], [-h, h, -h]] },
    ];

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let base = 0;

  for (const { normal, verts } of faces) {
    for (const v of verts) {
      positions.push(...v);
      normals.push(...normal);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    base += 4;
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
  };
}

// const root = {
//   id: 'root',
//   type: 'rect',
//   x: 0,
//   y: 0,
//   width: 1000,
//   height: 1000
// };
// nodes.forEach((node) => node.parentId = root.id);
// console.log('nodes', nodes);

const canvas = document.querySelector<HTMLElement>('#canvas1')!;
canvas.addEventListener(Event.READY, async (e) => {
  const api = e.detail;

  // api.onchange = (e) => {
  //   const { appState, nodes } = e;
  //   console.log('selected', appState.layersSelected);
  // };

  // api.runAtNextTick(() => {
  api.setAppState({
    cameraZoom: 1,
    penbarSelected: Pen.SELECT,
    penbarAll: [
      Pen.HAND,
      Pen.SELECT,
      Pen.DRAW_RECT,
      Pen.DRAW_ELLIPSE,
      Pen.DRAW_TRIANGLE,
      Pen.DRAW_PENTAGON,
      Pen.DRAW_HEXAGON,
      Pen.DRAW_LINE,
      Pen.DRAW_ARROW,
      Pen.DRAW_ROUGH_RECT,
      Pen.DRAW_ROUGH_ELLIPSE,
      Pen.DRAW_ICONFONT,
      Pen.IMAGE,
      Pen.LASSO,
      Pen.TEXT,
      Pen.PENCIL,
      Pen.BRUSH,
      Pen.ERASER,
      Pen.LASER_POINTER,
    ],
    penbarLasso: {
      ...api.getAppState().penbarLasso,
      // mode: 'draw',
      // fill: 'none',
      // stroke: 'red',
      // strokeWidth: 2,
    },
    penbarText: {
      ...api.getAppState().penbarText,
      fontFamily: 'system-ui',
      fontFamilies: ['system-ui', 'serif', 'monospace', 'Gaegu'],
    },
    penbarPencil: {
      ...api.getAppState().penbarPencil,
      freehand: true,
    },
    taskbarAll: [
      Task.SHOW_CHAT_PANEL,
      Task.SHOW_LAYERS_PANEL,
      Task.SHOW_PROPERTIES_PANEL,
    ],
    taskbarSelected: [
      Task.SHOW_PROPERTIES_PANEL,
    ],
    propertiesPanelSectionsOpen: {
      fillSection: false,
      strokeSection: false,
      shape: false,
      transform: false,
      layout: false,
      flexItem: false,
      effects: false,
      multiSelectAlignment: false,
      multiSelectEffects: false,
      exportSection: true,
      iconFont: true,
    },
    penbarVisible: true,
    taskbarVisible: true,
    checkboardStyle: CheckboardStyle.GRID,
    snapToPixelGridEnabled: true,
    snapToPixelGridSize: 1,
    // snapToPixelGridEnabled: false,
    // snapToPixelGridSize: 0,
    // snapToObjectsEnabled: true,
    // filter: 'brightness(0.8) noise(0.1)',
    // penbarDrawSizeLabelVisible: true,
    // penbarSelected: Pen.SELECT,
    // contextBarVisible: false,
    // penbarVisible: false,
    // taskbarVisible: false,
    rotateEnabled: true,
    flipEnabled: true,
    // giEnabled: true,
    // giStrength: 0.05,
    // themeMode: ThemeMode.DARK,
    // filter: 'noise(0.5)',
    // layersLassoing: ['parent'],
    // filter: 'fxaa() brightness(0.8) noise(0.1)',
    // layersCropping: ['parent-1'],
  });

  const image2 = {
    id: 'glitch-2',
    type: 'rect',
    fills: [{ type: 'image', value: 'https://v3b.fal.media/files/b/tiger/v1lf1EcPP1X1pw_YOKM4o.jpg', opacity: 1 }],
    x: 300,
    y: 50,
    width: 200,
    height: 200,
    lockAspectRatio: true,
    filter: 'crt(4, 4, 0.4, 0.27, 0.41, 1) vignette(0.5, 0.5) glitch(0.29, 0.15, auto, 0.29)',
  };

  api.updateNodes([image2]);

  // fetch('/applecycling.json').then(res => res.json()).then(data => {
  //   const animation = loadAnimation(data, {
  //     loop: true,
  //     autoplay: true,
  //   });

  //   api.runAtNextTick(() => {
  //     animation.render(api);
  //     animation.play();
  //   });
  // });

  // api.runAtNextTick(() => {
  //   const { positions, normals, indices } = createCubeGeometry(1);
  //   const commands = api.getCommands();

  //   commands.spawn(
  //     new Camera3D({
  //       eye: [3, 3, 5],
  //       center: [0, 0, 0],
  //       clearColor: true,
  //       // linked: true,
  //       // projection: 'orthographic',
  //     }),
  //   );

  //   const cubeEntity = commands
  //     .spawn(
  //       new Mesh3D({ positions, normals, indices }),
  //       new Material3D({
  //         baseColor: [0.25, 0.55, 0.95, 1],
  //         ambient: 0.15,
  //         diffuse: 0.75,
  //         specular: 0.4,
  //         shininess: 48,
  //       }),
  //       new Transform3D({
  //         translation: [0, 0, 0],
  //         rotation: [0.3, 0.6, 0],
  //         scale: [1, 1, 1],
  //       }),
  //     )
  //     .id()
  //     .hold();

  //   commands.execute();

  //   // 2D 图层：与 3D 共用同一画布，由 2D MeshPipeline 叠在立方体之上
  //   api.updateNodes([image1, overlayRect]);

  //   const t0 = performance.now();
  //   const spinCube = (now: number) => {
  //     const t = (now - t0) / 1000;
  //     const transform = cubeEntity.write(Transform3D);
  //     transform.rotation = [0.3 + t * 0.9, 0.6 + t * 1.2, t * 0.5];
  //     requestAnimationFrame(spinCube);
  //   };
  //   requestAnimationFrame(spinCube);
  // });
});

// const VelloRendererPlugin = RendererPlugin.configure({
//   setupDeviceSystemCtor: InitVello,
//   rendererSystemCtor: VelloPipeline,
// });
// DefaultPlugins.splice(DefaultPlugins.indexOf(DefaultRendererPlugin), 1, VelloRendererPlugin);
// registerFont('/Gaegu-Regular.ttf');
// registerFont('/NotoSansCJKsc-VF.ttf');
// registerFont('/NotoSans-Regular.ttf');
// registerFont('/NotoSans-Bold.ttf');
// registerFont('/NotoSans-Italic.ttf');
// registerFont('/NotoSansArabic.ttf');

try {
  const app = new App().addPlugins(
    ...DefaultPlugins,
    DefaultRenderer3DPlugin,
    FilterPlugin,
    UIPlugin,
    EraserPlugin,
    LaserPointerPlugin,
    LassoPlugin,
    YogaPlugin
  );
  app.run();
} catch (e) {
  console.log(e);
}
