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
    cameraZoom: 1,
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
    rotateEnabled: true,
    flipEnabled: true,
    // filter: 'noise(0.5)',
    // layersLassoing: ['parent'],
  });

  const node1 = {
    id: 'binding-curved-rect-1',
    type: 'rect',
    x: 100,
    y: 0,
    width: 100,
    height: 100,
    fill: 'grey',
    zIndex: 1,
  };
  const node2 = {
    id: 'binding-curved-rect-2',
    type: 'ellipse',
    x: 225,
    y: 120,
    width: 100,
    height: 100,
    fill: 'red',
  };
  const node3 = {
    id: 'binding-curved-rect-3',
    type: 'rect',
    x: 400,
    y: 150,
    width: 100,
    height: 100,
    fill: 'green',
  };
  const edge1 = {
    id: 'binding-curved-line-1',
    type: 'path',
    // type: 'polyline',
    // type: 'line',
    fromId: 'binding-curved-rect-1',
    toId: 'binding-curved-rect-1',
    // targetPoint: {
    //   x: 300,
    //   y: 0,
    // },
    stroke: 'black',
    strokeWidth: 10,
    markerEnd: 'line',
    edgeStyle: EdgeStyle.ORTHOGONAL,
    // exitX: 0.5,
    // exitY: 0.5,
    // exitDx: 0,
    // exitDy: 50,
    curved: true,
  };
  const edge2 = {
    id: 'binding-curved-line-2',
    type: 'path',
    fromId: 'binding-curved-rect-2',
    toId: 'binding-curved-rect-3',
    stroke: 'black',
    strokeWidth: 10,
    markerEnd: 'line',
    edgeStyle: EdgeStyle.ORTHOGONAL,
    curved: true,
  };

  api.updateNodes([
    node1,
    // node2, node3,
    // edge1, edge2
  ]);
  // api.selectNodes([node1])

  // api.updateNodes([node1]);
});

const VelloRendererPlugin = RendererPlugin.configure({
  setupDeviceSystemCtor: InitVello,
  rendererSystemCtor: VelloPipeline,
});
DefaultPlugins.splice(DefaultPlugins.indexOf(DefaultRendererPlugin), 1, VelloRendererPlugin);
registerFont('/Gaegu-Regular.ttf');
// registerFont('/NotoSansCJKsc-VF.ttf');
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
