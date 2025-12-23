import {
  App,
  svgElementsToSerializedNodes,
  svgSvgElementToComputedCamera,
  DefaultPlugins,
  Pen,
  Task,
  CheckboardStyle,
  BrushType,
} from '../../ecs';
import { Event, UIPlugin } from '../src';
import '../src/spectrum';
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
    snapToPixelGridSize: 1,
    // snapToObjectsEnabled: true,
    // checkboardStyle: CheckboardStyle.NONE,
    // penbarSelected: Pen.SELECT,
    // topbarVisible: false,
    // contextBarVisible: false,
    // penbarVisible: false,
    // taskbarVisible: false,
    // rotateEnabled: false,
    // flipEnabled: false,
  });

  // api.updateNodes(nodes);

  api.updateNodes([
    {
      id: 'rect-1',
      type: 'rect',
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      fill: 'grey',
    },
    {
      id: 'rect-2',
      type: 'rect',
      parentId: 'rect-1',
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      fill: 'blue',
    },
    {
      id: 'rect-3',
      type: 'rect',
      parentId: 'rect-2',
      x: 150,
      y: 150,
      width: 50,
      height: 50,
      fill: 'yellow',
    },
  ]);

  setTimeout(() => {
    api.updateNode({
      id: 'rect-1',
      x: 100,
      y: 100,
    });
  }, 2000);
});

try {
  const app = new App().addPlugins(...DefaultPlugins, UIPlugin);
  app.run();
} catch (e) {
  console.log(e);
}
