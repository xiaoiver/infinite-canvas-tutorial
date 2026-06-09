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
  Light3D,
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

  // // MDN mix-blend-mode 三色椭圆演示（与 MDN 文档 SVG 结构一致）
  // const DEMO = 150;
  // const GAP = 28;
  // const ORIGIN_X = 48;
  // const ORIGIN_Y = 72;

  // const ELLIPSE_CX = 75;
  // const ELLIPSE_CY = 75;
  // const ELLIPSE_RX = 25;
  // const ELLIPSE_RY = 70;

  // /** ECS Transform 绕 (x,y) 旋转；补偿为 MDN `transform-origin: center`（cx,cy）效果。 */
  // const ellipseNodeForCenterRotation = (
  //   ox: number,
  //   oy: number,
  //   rotationDeg: number,
  // ) => {
  //   const rotation = (rotationDeg * Math.PI) / 180;
  //   const cos = Math.cos(rotation);
  //   const sin = Math.sin(rotation);
  //   const centerX = ox + ELLIPSE_CX;
  //   const centerY = oy + ELLIPSE_CY;
  //   const rotLocalCx = ELLIPSE_RX * cos - ELLIPSE_RY * sin;
  //   const rotLocalCy = ELLIPSE_RX * sin + ELLIPSE_RY * cos;
  //   return {
  //     x: centerX - rotLocalCx,
  //     y: centerY - rotLocalCy,
  //     width: ELLIPSE_RX * 2,
  //     height: ELLIPSE_RY * 2,
  //     rotation,
  //   };
  // };

  // const RGB_ELLIPSES = [
  //   {
  //     id: 'R',
  //     rotation: -30,
  //     fill: 'linear-gradient(90deg, #ff0000 0%, #ffffff 100%)',
  //   },
  //   {
  //     id: 'G',
  //     rotation: 90,
  //     fill: 'linear-gradient(90deg, #00ff00 0%, #ffffff 100%)',
  //   },
  //   {
  //     id: 'B',
  //     rotation: 210,
  //     fill: 'linear-gradient(90deg, #0000ff 0%, #ffffff 100%)',
  //   },
  // ] as const;

  // const DEMO_BG_FILLS = [
  //   { type: 'gradient' as const, value: 'linear-gradient(to bottom, yellow 0%, magenta 50%, cyan 100%)' },
  //   {
  //     type: 'gradient' as const,
  //     value: 'linear-gradient(to right, black 0%, transparent 50%, white 100%)',
  //   },
  // ];

  // const blendModes = [
  //   'normal',
  //   'multiply',
  //   'screen',
  //   'overlay',
  //   'difference',
  //   'colorBurn',
  //   'colorDodge',
  //   'softLight',
  // ] as const;

  // const nodes: SerializedNode[] = [
  //   {
  //     id: 'blend-title',
  //     type: 'text',
  //     anchorX: ORIGIN_X,
  //     anchorY: 24,
  //     content: 'MDN 三色椭圆 — 每层 ellipse 使用相同 blendMode 与下方内容合成',
  //     fontSize: 14,
  //     fontFamily: 'system-ui',
  //     textBaseline: 'top',
  //     fills: [{ type: 'solid', value: '#374151' }],
  //     zIndex: 100,
  //   },
  // ];

  // const addRgbEllipseDemo = (
  //   prefix: string,
  //   ox: number,
  //   oy: number,
  //   blendMode: (typeof blendModes)[number],
  //   label?: string,
  // ) => {
  //   nodes.push({
  //     id: `${prefix}-bg`,
  //     type: 'rect',
  //     x: ox,
  //     y: oy,
  //     width: DEMO,
  //     height: DEMO,
  //     fills: [...DEMO_BG_FILLS],
  //     zIndex: 0,
  //   });

  //   RGB_ELLIPSES.forEach(({ id, rotation, fill }, i) => {
  //     const ellipse = ellipseNodeForCenterRotation(ox, oy, rotation);
  //     nodes.push({
  //       id: `${prefix}-${id}`,
  //       type: 'ellipse',
  //       ...ellipse,
  //       fills: [{ type: 'gradient', value: fill }],
  //       blendMode,
  //       zIndex: i + 1,
  //     });
  //   });

  //   if (label) {
  //     nodes.push({
  //       id: `${prefix}-label`,
  //       type: 'text',
  //       anchorX: ox,
  //       anchorY: oy + DEMO + 8,
  //       content: label,
  //       fontSize: 11,
  //       fontFamily: 'system-ui',
  //       textBaseline: 'top',
  //       fills: [{ type: 'solid', value: '#6b7280' }],
  //       zIndex: 100,
  //     });
  //   }
  // };

  // blendModes.forEach((mode, i) => {
  //   const col = i % 4;
  //   const row = Math.floor(i / 4);
  //   addRgbEllipseDemo(
  //     `blend-${mode}`,
  //     ORIGIN_X + col * (DEMO + GAP),
  //     ORIGIN_Y + row * (DEMO + GAP + 24),
  //     mode,
  //     mode,
  //   );
  // });

  // api.updateNodes(nodes);

  const node1: RectSerializedNode = {
    id: '1',
    type: 'rect',
    fills: [{ type: 'solid', value: 'red', opacity: 1 }],
    x: 50,
    y: 50,
    width: 100,
    height: 100,
    zIndex: 0,
  };

  const node2: RectSerializedNode = {
    id: '2',
    parentId: '1',
    type: 'rect',
    fills: [{ type: 'solid', value: 'green', opacity: 1 }],
    x: 50,
    y: 50,
    width: 50,
    height: 50,
    strokes: [{ type: 'solid', value: 'black', opacity: 1 }],
    strokeWidth: 10,
    strokeAlignment: 'center',
    strokeDasharray: '10 10',
    dropShadowColor: 'black',
    dropShadowBlurRadius: 10,
    dropShadowOffsetX: 10,
    dropShadowOffsetY: 10,
    zIndex: 0,
  };

  api.updateNodes([
    node1,
    node2,
  ]);
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
