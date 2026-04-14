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

  const path = {
    "id": "d1522006-323e-41c6-bcd5-90003f6e8878",
    "type": "path",
    "name": "形状图层 19 合成 1",
    d: "M0 0 L100 0 L100 100 L0 100 Z",
    "fill": "linear-gradient(0deg, rgb(0, 255, 255) 0%, rgb(255, 255, 255) 1%, rgb(0, 255, 255) 2.5%, rgb(255, 255, 0) 15.690000000000001%)",
  }

  // const child = {
  //   id: '22',
  //   type: 'ellipse',
  //   x: 0,
  //   y: 0,
  //   width: 100,
  //   height: 100,
  //   fill: 'red',
  //   parentId: 'd1522006-323e-41c6-bcd5-90003f6e8878',
  // }

  api.updateNodes([path])

  // const animation = api.animate(path, [
  //   {
  //     "offset": 0,
  //     "fill": "linear-gradient(0deg, rgb(255, 255, 255) 0%, rgb(255, 255, 255) 1%, rgb(255, 255, 255) 2.5%, rgb(255, 255, 255) 15.690000000000001%)"
  //   },
  //   {
  //     "offset": 1,
  //     "fill": "linear-gradient(0deg, rgb(0, 255, 255) 81.3%, rgb(255, 0, 255) 97.16%, rgb(255, 255, 255) 98.16%, rgb(255, 255, 255) 100%)"
  //   }
  // ], {
  //   delay: 0,
  //   duration: 2000,
  //   easing: 'cubic-bezier(0.42,0,1,1)',
  //   iterations: 'infinite',
  // });

  // animation.play();
  // api.selectNodes([node1])

  // fetch('/gradient-text.json').then(res => res.json()).then(data => {
  //   const animation = loadAnimation(data, {
  //     loop: true,
  //     autoplay: true,
  //   });

  //   api.runAtNextTick(() => {
  //     animation.render(api);
  //     animation.play();
  //   });
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
