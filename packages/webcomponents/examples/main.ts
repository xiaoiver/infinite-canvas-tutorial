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

const camera = svgSvgElementToComputedCamera($svg);
const nodes = svgElementsToSerializedNodes(
  Array.from($svg.children) as SVGElement[],
);

console.log('nodes', nodes);

const canvas = document.querySelector<HTMLElement>('#canvas1')!;
canvas.addEventListener(Event.READY, async (e) => {
  const api = e.detail;

  // Generate sinewave geometry
  // const maxRadius = (1 / 3) * 100;
  // const segmentCount = 32;

  // const position: [number, number][] = [];
  // const radius: number[] = [];

  // const gr = (1 + Math.sqrt(5)) / 2; // golden ratio
  // const pi = Math.PI;

  // for (let i = 0; i <= segmentCount; ++i) {
  //   let a = i / segmentCount;
  //   let x = -pi + 2 * pi * a;
  //   let y = Math.sin(x) / gr;
  //   let r = Math.cos(x / 2.0) * maxRadius;

  //   position.push([x * 100, y * 100]);
  //   radius.push(r);
  // }

  // const nodes = [
  //   // {
  //   //   id: '1',
  //   //   type: 'vector-network',
  //   //   stroke: 'red',
  //   //   strokeWidth: 10,
  //   //   vertices: [
  //   //     { x: 100, y: 100 },
  //   //     { x: 200, y: 200 },
  //   //     { x: 300, y: 200 },
  //   //   ],
  //   //   segments: [
  //   //     {
  //   //       start: 0,
  //   //       end: 1,
  //   //     },
  //   //     {
  //   //       start: 1,
  //   //       end: 2,
  //   //     },
  //   //   ],
  //   // } as const,
  //   {
  //     id: '1',
  //     type: 'polyline',
  //     stroke: 'red',
  //     strokeWidth: 10,
  //     points: '100,100 200,200 300,200',
  //   } as const,
  //   // {
  //   //   id: '1',
  //   //   type: 'text',
  //   //   fill: 'black',
  //   //   content: 'Hello world',
  //   //   fontSize: 16,
  //   //   fontFamily: 'system-ui',
  //   //   textAlign: 'center',
  //   //   anchorX: 100,
  //   //   anchorY: 100,
  //   // },
  //   // {
  //   //   id: '1',
  //   //   type: 'brush',
  //   //   points: position.map(([x, y], i) => `${x},${y},${radius[i]}`).join(' '),
  //   //   brushType: BrushType.STAMP,
  //   //   brushStamp: '/brush.jpg',
  //   //   stroke: 'red',
  //   //   strokeOpacity: 1,
  //   //   // wireframe: true,
  //   // },
  // ];

  // api.runAtNextTick(() => {
  api.setAppState({
    // penbarSelected: Pen.VECTOR_NETWORK,
    penbarSelected: Pen.SELECT,
    penbarText: {
      ...api.getAppState().penbarText,
      fontFamily: 'system-ui',
      fontFamilies: ['system-ui', 'serif', 'monospace', 'Gaegu'],
    },
    // taskbarSelected: [Task.SHOW_LAYERS_PANEL],
    checkboardStyle: CheckboardStyle.GRID,
    snapToPixelGridEnabled: true,
    snapToPixelGridSize: 10,
    snapToObjectsEnabled: true,
    // checkboardStyle: CheckboardStyle.NONE,
    // penbarSelected: Pen.SELECT,
    // topbarVisible: false,
    // contextBarVisible: false,
    // penbarVisible: false,
    // taskbarVisible: false,
    // rotateEnabled: false,
    // flipEnabled: false,
  });

  api.updateNodes(nodes);
  // api.selectNodes(nodes);

  api.record();
  // });
});

// canvas.addEventListener(Event.SCREENSHOT_DOWNLOADED, (e) => {
//   const { dataURL, svg } = e.detail;

//   console.log(dataURL, svg);
// });

// canvas.addEventListener(Event.SELECTED_NODES_CHANGED, (e) => {
//   console.log(e.detail);
// });

// canvas.addEventListener(Event.NODE_UPDATED, (e) => {
//   console.log(e.detail);
// });

// canvas.addEventListener(Event.NODES_UPDATED, (e) => {
//   console.log(e.detail);
// });

// const canvas2 = document.querySelector<HTMLElement>('#canvas2')!;
// canvas2.addEventListener(Event.READY, (e) => {
//   const api = e.detail;
//   api.setPen(Pen.SELECT);

//   const node = {
//     id: '1',
//     type: 'rect',
//     x: 100,
//     y: 100,
//     width: 100,
//     height: 100,
//     fill: 'green',
//   };
//   api.updateNodes([node]);
//   api.selectNodes([node]);
// });

try {
  const app = new App().addPlugins(...DefaultPlugins, UIPlugin);
  app.run();
} catch (e) {
  console.log(e);
}
