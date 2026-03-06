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
} from '../../ecs';
import { Event, UIPlugin } from '../src';
import '../src/spectrum';
import { LaserPointerPlugin } from '../../plugin-laser-pointer/src';
import { EraserPlugin } from '../../plugin-eraser/src';
import { LassoPlugin } from '../../plugin-lasso/src';
import { YogaPlugin } from '../../plugin-yoga/src';
import '../../plugin-laser-pointer/src/spectrum';
import '../../plugin-eraser/src/spectrum';
import '../../plugin-lasso/src/spectrum';
import WebFont from 'webfontloader';

WebFont.load({
  google: {
    families: ['Gaegu'],
  },
});

const res = await fetch('/test.svg');
// const res = await fetch('/maslow-hierarchy.svg');
// const res = await fetch('/mindmap.svg');
// const res = await fetch('/test-camera.svg');
// const res = await fetch(
//   '/62f5208ddbc232ac973f53d9cfd91ba463c50b8bfd846349247709fe4a7a9053.svg',
// );
// const svg = await res.text();
// TODO: extract semantic groups inside comments
// const $container = document.createElement('div');
// $container.innerHTML = svg;
// const $svg = $container.children[0] as SVGSVGElement;

// const camera = svgSvgElementToComputedCamera($svg);
// const nodes = svgElementsToSerializedNodes(
//   Array.from($svg.children) as SVGElement[],
// );

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
    cameraX: 0,
    // cameraZoom: 0.35,
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
      // Pen.TEXT,
      // Pen.PENCIL,
      // Pen.BRUSH,
      // Pen.ERASER,
      // Pen.LASER_POINTER,
    ],
    penbarLasso: {
      ...api.getAppState().penbarLasso,
      mode: 'draw',
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
    penbarVisible: false,
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
  });

  const parent = {
    id: 'parent',
    type: 'rect',
    x: 100,
    y: 100,
    fill: 'hsl(214.82, 100%, 50%)',
    // display: 'flex',
    width: 200,
    height: 250,
    // padding: 10,
    // flexWrap: 'wrap',
    // gap: 10,
    zIndex: 0,
  } as const;

  const child = {
    id: 'child',
    // parentId: 'parent',
    type: 'rect',
    fill: 'red',
    x: 100,
    y: 100,
    width: 50,
    height: 50,
    zIndex: 1,
  } as const;

  // const child2 = {
  //   id: 'child3',
  //   parentId: 'parent',
  //   type: 'text',
  //   content: 'Hello',
  //   fill: 'blue',
  //   fontSize: 20,
  //   fontFamily: 'system-ui',
  //   zIndex: 2,
  // } as const;

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

  api.updateNodes([
    {
      id: 'baseline-1',
      type: 'line',
      x1: 50,
      y1: 0,
      x2: 50,
      y2: 200,
      stroke: 'red',
      strokeWidth: 1,
      zIndex: 0,
    },
    {
      id: 'text-1',
      type: 'text',
      fill: 'black',
      content: 'Test',
      anchorX: 50,
      anchorY: 50,
      fontSize: 16,
      fontFamily: 'sans-serif',
      zIndex: 1,
    },
    {
      id: 'text-2',
      type: 'text',
      fill: 'black',
      content: 'Test',
      anchorX: 50,
      anchorY: 100,
      fontSize: 16,
      fontFamily: 'sans-serif',
      textAlign: 'center',
      zIndex: 2,
    },
    {
      id: 'text-3',
      type: 'text',
      fill: 'black',
      content: 'Test',
      anchorX: 50,
      anchorY: 150,
      fontSize: 16,
      fontFamily: 'sans-serif',
      textAlign: 'right',
      zIndex: 3,
    },
  ]);
  // api.selectNodes([parent]);
  api.record();

  // api.updateNodes([node1]);
});

try {
  const app = new App().addPlugins(
    ...DefaultPlugins,
    UIPlugin,
    EraserPlugin,
    LaserPointerPlugin,
    LassoPlugin,
    // YogaPlugin
  );
  app.run();
} catch (e) {
  console.log(e);
}
