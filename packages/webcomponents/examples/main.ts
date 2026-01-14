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
} from '../../ecs';
import { Event, UIPlugin } from '../src';
import '../src/spectrum';
import { LaserPointerPlugin } from '../../plugin-laser-pointer';
import { EraserPlugin } from '../../plugin-eraser';
import { LassoPlugin } from '../../plugin-lasso';
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
const svg = await res.text();
// TODO: extract semantic groups inside comments
const $container = document.createElement('div');
$container.innerHTML = svg;
const $svg = $container.children[0] as SVGSVGElement;

// const camera = svgSvgElementToComputedCamera($svg);
// const nodes = svgElementsToSerializedNodes(
//   Array.from($svg.children) as SVGElement[],
// );

// console.log('nodes', nodes);

const canvas = document.querySelector<HTMLElement>('#canvas1')!;
canvas.addEventListener(Event.READY, async (e) => {
  const api = e.detail;

  // api.runAtNextTick(() => {
  api.setAppState({
    cameraX: 0,
    // cameraZoom: 0.35,
    // penbarSelected: Pen.VECTOR_NETWORK,
    penbarSelected: Pen.SELECT,
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
    checkboardStyle: CheckboardStyle.GRID,
    snapToPixelGridEnabled: true,
    snapToPixelGridSize: 10,
    // snapToPixelGridEnabled: false,
    // snapToPixelGridSize: 0,
    snapToObjectsEnabled: true,
    filter: 'brightness(0.8) noise(0.1)',
    // penbarDrawSizeLabelVisible: true,
    // checkboardStyle: CheckboardStyle.NONE,
    // penbarSelected: Pen.SELECT,
    // topbarVisible: false,
    // contextBarVisible: false,
    // penbarVisible: false,
    // taskbarVisible: false,
    // rotateEnabled: false,
    // flipEnabled: false,
    // filter: 'noise(0.5)',
  });

  // api.updateNodes(nodes);

  const node1 = {
    id: 'rect-1',
    type: 'rect',
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    // fill: 'grey',
    fill: 'https://v3b.fal.media/files/b/tiger/v1lf1EcPP1X1pw_YOKM4o.jpg',
    // filter: 'noise(0.5)',
  };
  // const node2 = {
  //   id: 'text-1',
  //   type: 'text',
  //   parentId: 'rect-1',
  //   anchorX: 10,
  //   anchorY: 50,
  //   content: 'Hello',
  //   fill: 'black',
  //   fontSize: 30,
  //   fontFamily: 'system-ui',
  // };
  // const node3 = {
  //   id: 'rect-2',
  //   type: 'rect',
  //   x: 100,
  //   y: 100,
  //   width: 200,
  //   height: 200,
  //   fill: 'red',
  // };

  // const node4 = {
  //   id: 'rect-3',
  //   type: 'rect',
  //   x: 100,
  //   y: 100,
  //   width: 100,
  //   height: 100,
  //   fill: 'green',
  // };

  // api.updateNodes([node1, node3, node4]);
  // api.updateNode(node1);
  // api.record();
});

try {
  const app = new App().addPlugins(
    ...DefaultPlugins,
    UIPlugin,
    EraserPlugin,
    LaserPointerPlugin,
  );
  app.run();
} catch (e) {
  console.log(e);
}
