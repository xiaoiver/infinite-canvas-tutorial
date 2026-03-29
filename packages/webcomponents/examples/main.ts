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

const res = await fetch('/Ghostscript_Tiger.svg');
// const res = await fetch('/maslow-hierarchy.svg');
// const res = await fetch('/mindmap.svg');
// const res = await fetch('/test-camera.svg');
// const res = await fetch(
//   '/62f5208ddbc232ac973f53d9cfd91ba463c50b8bfd846349247709fe4a7a9053.svg',
// );
const svg = await res.text();
// TODO: extract semantic groups inside comments
const $container = document.createElement('div');
$container.innerHTML = svg;
const $svg = $container.children[0] as SVGSVGElement;

// const camera = svgSvgElementToComputedCamera($svg);
const nodes = svgElementsToSerializedNodes(
  Array.from($svg.children) as SVGElement[],
);
nodes[0].x = 500;

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
    cameraX: -200,
    cameraY: -200,
    cameraZoom: 0.5,
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
      Pen.TEXT,
      // Pen.PENCIL,
      // Pen.BRUSH,
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
    penbarVisible: true,
    taskbarVisible: true,
    // checkboardStyle: CheckboardStyle.GRID,
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
    // rotateEnabled: false,
    flipEnabled: false,
    // filter: 'noise(0.5)',
    // layersLassoing: ['parent'],
  });

  const g = {
    id: 'g-1',
    type: 'g',
  };

  const g2 = {
    id: 'g-2',
    type: 'g',
    parentId: 'g-1',
  };

  const node1 = {
    id: 'polyline-1',
    parentId: 'g-1',
    type: 'polyline',
    points: '100,100 200,200 300,100 400,200',
    stroke: 'red',
    strokeWidth: 10,
    zIndex: 1,
    hitStrokeWidth: 10,
  };

  const node3 = {
    id: 'rect-3',
    // parentId: 'g-2',
    type: 'rect',
    x: 300,
    y: 500,
    width: 100,
    height: 100,
    fill: '/stamp.png',
    zIndex: 3,
  }

  const node4 = {
    id: 'rect-4',
    parentId: 'g-2',
    type: 'rect',
    x: 400,
    y: 400,
    width: 100,
    height: 100,
    fill: 'green',
    zIndex: 3,
  }

  api.updateNodes([
    // node1,
    // ...nodes,
    // node3,
    // g2,
    // node3,
    // node4,

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
      content: 'Abcdefghijklmnop (top)',
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
      content: 'Abcdefghijklmnop (middle)',
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
      content: 'Abcdefghijklmnop (bottom)',
      anchorX: 50,
      anchorY: 300,
      fontSize: 16,
      fontFamily: 'Gaegu',
      textBaseline: 'bottom',
      wordWrap: true,
      wordWrapWidth: 30,
      maxLines: 3,
      textOverflow: 'ellipsis',
      zIndex: 6,
    },
  ]);
  // api.selectNodes([node1]);
  // api.record();

  // api.updateNodes([node1]);
});

const VelloRendererPlugin = RendererPlugin.configure({
  setupDeviceSystemCtor: InitVello,
  rendererSystemCtor: VelloPipeline,
});
DefaultPlugins.splice(DefaultPlugins.indexOf(DefaultRendererPlugin), 1, VelloRendererPlugin);
registerFont('/Gaegu-Regular.ttf');
registerFont('/NotoSansCJKsc-VF.ttf');
// registerFont('/NotoSans-Regular.ttf');
// registerFont('/NotoSans-Bold.ttf');
// registerFont('/NotoSans-Italic.ttf');
// registerFont('/NotoSansArabic.ttf');

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
