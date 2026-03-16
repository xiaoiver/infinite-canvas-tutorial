import {
  App,
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
  FillSolid,
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
} from '../../ecs';
import { Event, UIPlugin } from '../src';
import '../src/spectrum';
import { LaserPointerPlugin } from '../../plugin-laser-pointer/src';
import { EraserPlugin } from '../../plugin-eraser/src';
import { LassoPlugin } from '../../plugin-lasso/src';
import { YogaPlugin } from '../../plugin-yoga/src';
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

// const res = await fetch('/Ghostscript_Tiger.svg');
// const res = await fetch('/maslow-hierarchy.svg');
const res = await fetch('/mindmap.svg');
// const res = await fetch('/test-camera.svg');
// const res = await fetch(
//   '/62f5208ddbc232ac973f53d9cfd91ba463c50b8bfd846349247709fe4a7a9053.svg',
// );
const svg = await res.text();
// TODO: extract semantic groups inside comments
const $container = document.createElement('div');
$container.innerHTML = svg;
const $svg = $container.children[0] as SVGSVGElement;

const camera = svgSvgElementToComputedCamera($svg);
const nodes = svgElementsToSerializedNodes(
  Array.from($svg.children) as SVGElement[],
);

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
    // cameraX: -200,
    // cameraY: -200,
    // cameraZoom: 0.5,
    penbarSelected: Pen.SELECT,
    penbarAll: [
      Pen.HAND,
      Pen.SELECT,
      Pen.DRAW_RECT,
      Pen.DRAW_ELLIPSE,
      Pen.DRAW_LINE,
      Pen.DRAW_ARROW,
      Pen.DRAW_ROUGH_RECT,
      Pen.DRAW_ROUGH_ELLIPSE,
      Pen.IMAGE,
      Pen.LASSO,
      // Pen.TEXT,
      // Pen.PENCIL,
      // Pen.BRUSH,
      Pen.ERASER,
      // Pen.LASER_POINTER,
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
    penbarVisible: true,
    taskbarVisible: true,
    checkboardStyle: CheckboardStyle.GRID,
    snapToPixelGridEnabled: true,
    snapToPixelGridSize: 10,
    // snapToPixelGridEnabled: false,
    // snapToPixelGridSize: 0,
    // snapToObjectsEnabled: true,
    // filter: 'brightness(0.8) noise(0.1)',
    // penbarDrawSizeLabelVisible: true,
    // checkboardStyle: CheckboardStyle.NONE,
    // penbarSelected: Pen.SELECT,
    // topbarVisible: false,
    // contextBarVisible: false,
    // penbarVisible: false,
    // taskbarVisible: false,
    // rotateEnabled: false,
    flipEnabled: false,
    // filter: 'noise(0.5)',
    // layersLassoing: ['parent'],
  });

  const parent = {
    id: 'parent',
    type: 'rect',
    x: 100,
    y: 100,
    fill: 'red',
    // fill: '/canvas.png',
    // fill: 'conic-gradient(red, blue, green)',
    // display: 'flex',
    width: 100,
    height: 200,
    filter: 'drop-shadow(16px 16px 10px blue) blur(10px)',
    cornerRadius: 10,
    // padding: 10,
    // flexWrap: 'wrap',
    // gap: 10,
    zIndex: 0,
  } as const;

  const child = {
    id: 'child',
    parentId: 'parent',
    type: 'rough-rect',
    // fill: 'red',
    // fill: 'linear-gradient(to right, red, blue)',
    // fill: 'radial-gradient(circle at center, red, blue)',
    // fill: 'conic-gradient(red, blue, green)',
    // fill: 'linear-gradient(to right, red, blue), radial-gradient(circle at center, green, blue)',
    fill: 'red',
    stroke: 'black',
    strokeWidth: 10,
    x: 100,
    y: 100,
    width: 50,
    height: 50,
    zIndex: 1,
  } as const;

  const child2 = {
    id: 'child3',
    // parentId: 'parent',
    type: 'text',
    content: 'Hello world happy 测试中文',
    anchorX: 100,
    anchorY: 100,
    fill: 'blue',
    fontSize: 32,
    fontFamily: 'NotoSans',
    zIndex: 2,
  } as const;

  const child3 = {
    id: 'child3',
    parentId: 'parent',
    type: 'rough-path',
    d: 'M 100 100 L 200 200 L 300 100 Z',
    fill: 'red',
    stroke: 'black',
    strokeWidth: 10,
    zIndex: 3,
  } as const;

  const child4 = {
    id: 'child4',
    parentId: 'parent',
    type: 'ellipse',
    x: 200,
    y: 200,
    width: 50,
    height: 50,
    r: 50,
    fill: 'blue',
    stroke: 'black',
    strokeWidth: 10,
    zIndex: 4,
  } as const;

  const child5 = {
    id: 'child5',
    type: 'line',
    x1: 100,
    y1: 400,
    x2: 200,
    y2: 200,
    stroke: 'black',
    strokeWidth: 10,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeMiterlimit: 10,
    zIndex: 5,
  } as const;

  const child6 = {
    id: 'child6',
    type: 'path',
    d: 'M 100 100 L 200 200 L 300 100 Z',
    fill: 'red',
    stroke: 'black',
    strokeWidth: 10,
    zIndex: 6,
  } as const;

  const child7 = {
    id: 'child7',
    type: 'polyline',
    points: '400,400 500,500 700,500',
    stroke: 'black',
    strokeWidth: 10,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeDasharray: '10, 20',
    strokeDashoffset: 10,
    zIndex: 7,
  } as const;

  // console.log('nodes', nodes);

  api.updateNodes([
    // parent, child,  child7,
    // ...nodes,
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
      fill: 'black',
      content: 'Abcdefghijklmnop (top) 🚀MM',
      anchorX: 50,
      anchorY: 50,
      fontSize: 16,
      fontFamily: 'sans-serif',
      textBaseline: 'top',
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
      fill: 'black',
      content: 'Abcdefghijklmnop (hanging)',
      anchorX: 50,
      anchorY: 100,
      fontSize: 16,
      fontFamily: 'sans-serif',
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
      fill: 'black',
      content: 'Abcdefghijklmnop (middle) 🚀',
      anchorX: 50,
      anchorY: 150,
      fontSize: 16,
      fontFamily: 'sans-serif',
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
      fill: 'black',
      content: 'Abcdefghijklmnop (alphabetic)',
      anchorX: 50,
      anchorY: 200,
      fontSize: 16,
      fontFamily: 'sans-serif',
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
      fill: 'black',
      content: 'Abcdefghijklmnop (ideographic)',
      anchorX: 50,
      anchorY: 250,
      fontSize: 16,
      fontFamily: 'sans-serif',
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
      fill: 'black',
      content: 'Abcdefghijklmnop (bottom)\nAbcdefghijklmnop 你好世界',
      anchorX: 50,
      anchorY: 300,
      fontSize: 16,
      fontFamily: 'sans-serif',
      textBaseline: 'bottom',
      zIndex: 6,
    },
    // child4, child5, child6, child7
  ]);
  // api.selectNodes([parent]);
  // api.record();

  // api.updateNodes([node1]);
});

const VelloRendererPlugin = RendererPlugin.configure({
  setupDeviceSystemCtor: InitVello,
  rendererSystemCtor: VelloPipeline,
});
DefaultPlugins.splice(DefaultPlugins.indexOf(DefaultRendererPlugin), 1, VelloRendererPlugin);
registerFont('/NotoSansCJKsc-VF.ttf');

try {
  const app = new App().addPlugins(
    ...DefaultPlugins,
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
