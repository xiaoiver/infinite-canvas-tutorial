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
  ThemeMode,
  RectSerializedNode,
} from '../../ecs';
import { Event, UIPlugin } from '../src';
import '../src/spectrum';
import { LaserPointerPlugin } from '../../plugin-laser-pointer/src';
import { EraserPlugin } from '../../plugin-eraser/src';
import { LassoPlugin } from '../../plugin-lasso/src';
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
      Pen.DRAW_TRIANGLE,
      Pen.DRAW_PENTAGON,
      Pen.DRAW_HEXAGON,
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
  });

  const node2 = {
    id: 'binding-curved-rect-2',
    type: 'ellipse',
    x: 225,
    y: 120,
    width: 100,
    height: 100,
    fill: 'red',
    zIndex: 2,
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

  const line = {
    id: 'line-1',
    type: 'line',
    x1: 100,
    y1: 200,
    x2: 200,
    y2: 300,
    stroke: 'white',
    strokeWidth: 10,
  };

  const polyline = {
    id: 'polyline-1',
    type: 'polyline',
    points: '100,0 200,100 300,0',
    stroke: 'white',
    strokeWidth: 10,
    zIndex: 3,
  };

  const nodes = [
    {
      "id": "b8ca2b72-6d88-4a5d-b1c8-14e9c66b7a37",
      "type": "g",
      "name": "Shapes"
    },
    {
      "id": "6a9cdc05-9a6e-4ff6-90a9-0a8ece844e53",
      "type": "g",
      "name": "Cubic Lines",
      "parentId": "b8ca2b72-6d88-4a5d-b1c8-14e9c66b7a37"
    },
    {
      "id": "c612e1ca-8f7d-4694-8ddb-bf3919124b2a",
      "type": "path",
      "d": "M0 230C0 230 105 0 105 0C105 0 325 60 325 60C325 60 460 230 460 230",
      "zIndex": 0,
      "scaleX": 1,
      "scaleY": 1,
      "stroke": "rgba(0,0,0,1)",
      "strokeOpacity": 1,
      "strokeWidth": 10,
      "parentId": "6a9cdc05-9a6e-4ff6-90a9-0a8ece844e53",
      "x": 25,
      "y": 170,
      "width": 460,
      "height": 230
    },
    {
      "id": "ca406efb-1f72-4cf0-9321-84434fb08901",
      "type": "g",
      "name": "Cubic Points",
      "parentId": "b8ca2b72-6d88-4a5d-b1c8-14e9c66b7a37"
    },
    {
      "id": "1663295b-b600-48c9-a02c-67c2a371bfa6",
      "type": "ellipse",
      "cx": 485,
      "cy": 400,
      "rx": 16,
      "ry": 16,
      "zIndex": 0,
      "name": "p3",
      "scaleX": 1,
      "scaleY": 1,
      "fill": "rgba(0,0,0,1)",
      "fillRule": "nonzero",
      "fillOpacity": 1,
      "parentId": "ca406efb-1f72-4cf0-9321-84434fb08901",
      "x": 469,
      "y": 384,
      "width": 32,
      "height": 32
    },
    {
      "id": "661c734c-b854-4e0f-af55-8ce12a3b7aff",
      "type": "ellipse",
      "cx": 350,
      "cy": 230,
      "rx": 16,
      "ry": 16,
      "zIndex": 0,
      "name": "p2",
      "scaleX": 1,
      "scaleY": 1,
      "fill": "rgba(0,0,0,1)",
      "fillRule": "nonzero",
      "fillOpacity": 1,
      "parentId": "ca406efb-1f72-4cf0-9321-84434fb08901",
      "x": 334,
      "y": 214,
      "width": 32,
      "height": 32
    },
    {
      "id": "3c21ca95-1d92-4327-bcf1-54c9c4c1e44e",
      "type": "ellipse",
      "cx": 130,
      "cy": 170,
      "rx": 16,
      "ry": 16,
      "zIndex": 0,
      "name": "p1",
      "scaleX": 1,
      "scaleY": 1,
      "fill": "rgba(0,0,0,1)",
      "fillRule": "nonzero",
      "fillOpacity": 1,
      "parentId": "ca406efb-1f72-4cf0-9321-84434fb08901",
      "x": 114,
      "y": 154,
      "width": 32,
      "height": 32
    },
    {
      "id": "bbfd5f51-d8b2-45df-b902-0e10b01992c9",
      "type": "ellipse",
      "cx": 25,
      "cy": 400,
      "rx": 16,
      "ry": 16,
      "zIndex": 0,
      "name": "p0",
      "scaleX": 1,
      "scaleY": 1,
      "fill": "rgba(0,0,0,1)",
      "fillRule": "nonzero",
      "fillOpacity": 1,
      "parentId": "ca406efb-1f72-4cf0-9321-84434fb08901",
      "x": 9,
      "y": 384,
      "width": 32,
      "height": 32
    }
  ];

  // api.updateNodes(nodes);

  // api.selectNodes([node1])

  fetch('/bezier.json').then(res => res.json()).then(data => {
    const animation = loadAnimation(data, {
      loop: true,
      autoplay: true,
      expressions: true,
      expressionEngine: 'lottie-web',
    });

    api.runAtNextTick(() => {
      animation.render(api);
      animation.play();
    });
  });
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
