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
      effects: true,
      multiSelectAlignment: false,
      multiSelectEffects: false,
      exportSection: true,
      iconFont: true,
      typographySection: true,
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

  const nodes = [
    {
      id: 'baseline-1',
      type: 'line',
      x1: 0,
      y1: 50,
      x2: 300,
      y2: 50,
      stroke: 'red',
      strokeWidth: 1,
      zIndex: 0,
    },
    {
      id: 'text-1',
      type: 'text',
      fills: [{ type: 'solid', value: 'black', opacity: 1 }],
      content: 'Abcdefghijklmnop (top)',
      anchorX: 50,
      anchorY: 50,
      fontSize: 16,
      fontFamily: 'Gaegu',
      textBaseline: 'top',
      textAlign: 'center',
      zIndex: 1,
    },
    {
      id: 'baseline-2',
      type: 'line',
      x1: 0,
      y1: 100,
      x2: 300,
      y2: 100,
      stroke: 'red',
      strokeWidth: 1,
      zIndex: 3,
    },
    {
      id: 'text-2',
      type: 'text',
      fills: [{ type: 'solid', value: 'black', opacity: 1 }],
      content: 'Abcdefghijklmnop (hanging)',
      anchorX: 50,
      anchorY: 100,
      fontSize: 16,
      fontFamily: 'Gaegu',
      textBaseline: 'hanging',
      zIndex: 4,
    },
    {
      id: 'baseline-3',
      type: 'line',
      x1: 0,
      y1: 150,
      x2: 300,
      y2: 150,
      stroke: 'red',
      strokeWidth: 1,
      zIndex: 5,
    },
    {
      id: 'text-3',
      type: 'text',
      fills: [{ type: 'solid', value: 'black', opacity: 1 }],
      content: 'Abcdefghijklmnop (middle)',
      anchorX: 50,
      anchorY: 150,
      fontSize: 16,
      fontFamily: 'Gaegu',
      textBaseline: 'middle',
      zIndex: 6,
    },
    {
      id: 'baseline-4',
      type: 'line',
      x1: 0,
      y1: 200,
      x2: 300,
      y2: 200,
      stroke: 'red',
      strokeWidth: 1,
      zIndex: 5,
    },
    {
      id: 'text-4',
      type: 'text',
      fills: [{ type: 'solid', value: 'black', opacity: 1 }],
      content: 'Abcdefghijklmnop (alphabetic)',
      anchorX: 50,
      anchorY: 200,
      fontSize: 16,
      fontFamily: 'Gaegu',
      textBaseline: 'alphabetic',
      zIndex: 6,
    },
    {
      id: 'baseline-5',
      type: 'line',
      x1: 0,
      y1: 250,
      x2: 300,
      y2: 250,
      stroke: 'red',
      strokeWidth: 1,
      zIndex: 5,
    },
    {
      id: 'text-5',
      type: 'text',
      fills: [{ type: 'solid', value: 'black', opacity: 1 }],
      content: 'Abcdefghijklmnop (ideographic)',
      anchorX: 50,
      anchorY: 250,
      fontSize: 16,
      fontFamily: 'Gaegu',
      textBaseline: 'ideographic',
      zIndex: 6,
    },
    {
      id: 'baseline-6',
      type: 'line',
      x1: 0,
      y1: 300,
      x2: 300,
      y2: 300,
      stroke: 'red',
      strokeWidth: 1,
      zIndex: 5,
    },
    {
      id: 'text-6',
      type: 'text',
      fills: [{ type: 'solid', value: 'black', opacity: 1 }],
      content: 'Abcdefghijklmnop (bottom)',
      anchorX: 50,
      anchorY: 300,
      fontSize: 16,
      fontFamily: 'Gaegu',
      textBaseline: 'bottom',
      zIndex: 6,
    },
    {
      id: 'baseline-7',
      type: 'line',
      x1: 0,
      y1: 350,
      x2: 300,
      y2: 350,
      stroke: 'red',
      strokeWidth: 1,
      zIndex: 7,
    },
    {
      id: 'text-7',
      type: 'text',
      fills: [{ type: 'solid', value: 'black', opacity: 1 }],
      content: 'Abcdefghijklmnop (bottom)',
      anchorX: 50,
      anchorY: 350,
      fontSize: 16,
      fontFamily: 'Gaegu',
      textBaseline: 'bottom',
      wordWrap: true,
      wordWrapWidth: 30,
      maxLines: 3,
      textOverflow: 'ellipsis',
      zIndex: 7,
    },
    {
      id: 'text-8',
      type: 'text',
      fills: [{ type: 'solid', value: 'black', opacity: 1 }],
      content: 'سلام ABC גבא DEF 😁🚀',
      anchorX: 120,
      anchorY: 350,
      fontSize: 16,
      fontFamily: 'Gaegu',
      textBaseline: 'bottom',
      zIndex: 7,
    }
  ];

  api.updateNodes(nodes);

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

  // api.runAtNextTick(() => {
  //   const { positions, normals, indices } = createCubeGeometry(1);
  //   const commands = api.getCommands();

  //   // linked + orthographic：与 2D/extrude3d 共用 VP；linked + perspective：跟 2D 平移缩放 + 透视
  //   commands.spawn(
  //     new Camera3D({
  //       linked: true,
  //       // projection: 'orthographic',
  //       projection: 'perspective',
  //       clearColor: false,
  //     }),
  //   );

  //   const cubeEntity = commands
  //     .spawn(
  //       new Mesh3D({ positions, normals, indices }),
  //       new Material3D({
  //         baseColor: [1, 1, 1, 1],
  //         ambient: 0.25,
  //         diffuse: 0.75,
  //         specular: 0.4,
  //         shininess: 48,
  //       }),
  //       new Transform3D({
  //         translation: [100, 100, 40],
  //         rotation: [0.3, 0.6, 0],
  //         scale: [100, 100, 100],
  //       }),
  //     )
  //     .id()
  //     .hold();

  //   commands.execute();

  //   // 2D 图层：彩色铅笔效果（Lu et al. NPAR 2012 / PencilDrawing 默认参数）
  //   const colorPencilDemo = {
  //     id: 'color-pencil-demo',
  //     type: 'rect',
  //     width: 480,
  //     height: 480,
  //     x: 40,
  //     y: 40,
  //     fills: [{ type: 'image', value: '/flower.png', opacity: 1 }],
  //     lockAspectRatio: true,
  //     filter: 'color-pencil(2, 1, 8, 1, 1, url("/pencil0.jpg"))',
  //   };
  //   api.updateNodes([colorPencilDemo]);
  //   api.selectNodes([colorPencilDemo]);

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
