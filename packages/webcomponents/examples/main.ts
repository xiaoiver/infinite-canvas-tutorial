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

// console.log('nodes', nodes);

const canvas = document.querySelector<HTMLElement>('#canvas1')!;
canvas.addEventListener(Event.READY, async (e) => {
  const api = e.detail;

  // // Generate sinewave geometry
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

  const nodes = [
    {
      id: '1',
      // type: 'rough-rect',
      // type: 'rect',
      // d: 'M 70 110 C 70 140, 110 140, 110 110',
      type: 'polyline',
      points: '0,0 100,100 -100,100',
      // x: 100,
      // y: 100,
      // width: 100,
      // height: 100,
      stroke: 'black',
      strokeWidth: 10,
      // fill: 'red',
      // roughFillStyle: 'dots',
      // roughFillWeight: 5,
      // fill: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==',
      // fill: 'blob:http://localhost:8080/cd5e4cd2-3387-4874-b792-128d82644004',
      // fill: 'radial-gradient(circle at center, red, blue, green 100%)',
      zIndex: 1,
    },
    // {
    //   id: '2',
    //   type: 'text',
    //   content: 'Hello',
    //   anchorX: 100,
    //   anchorY: 100,
    //   fontSize: 20,
    //   fontFamily: 'Arial',
    //   fill: 'black',
    //   zIndex: 2,
    // },
    // {
    //   id: '1',
    //   type: 'brush',
    //   points: position.map(([x, y], i) => `${x},${y},${radius[i]}`).join(' '),
    //   brushType: BrushType.STAMP,
    //   brushStamp: '/brush.jpg',
    //   stroke: 'red',
    //   strokeOpacity: 1,
    //   // wireframe: true,
    // },
  ];

  // api.runAtNextTick(() => {
  api.setAppState({
    penbarSelected: Pen.TEXT,
    penbarText: {
      ...api.getAppState().penbarText,
      fontFamily: 'system-ui',
    },
    taskbarSelected: [Task.SHOW_LAYERS_PANEL],
  });

  api.updateNodes(nodes);
  api.selectNodes([nodes[0]]);

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
