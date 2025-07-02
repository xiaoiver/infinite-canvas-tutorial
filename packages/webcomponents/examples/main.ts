import {
  App,
  svgElementsToSerializedNodes,
  svgSvgElementToComputedCamera,
  DefaultPlugins,
  Pen,
  Task,
  CheckboardStyle,
} from '../../ecs';
import { Event, UIPlugin } from '../src';
import '../src/spectrum';

const res = await fetch('/maslow-hierarchy.svg');
// const res = await fetch('/test.svg');
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
  0,
);

console.log('nodes', nodes);

const canvas = document.querySelector<HTMLElement>('#canvas1')!;
canvas.addEventListener(Event.READY, async (e) => {
  const api = e.detail;

  // api.onchange = (e) => {
  //   console.log(e);
  // };

  api.setAppState({
    ...api.getAppState(),
    // checkboardStyle: CheckboardStyle.NONE,
    // topbarVisible: false,
    // contextBarVisible: false,
    penbarVisible: false,
    taskbarVisible: false,
    rotateEnabled: false,
    flipEnabled: false,
  });
  // api.setCheckboardStyle(CheckboardStyle.NONE);
  api.setPen(Pen.SELECT);
  // api.setTaskbars([Task.SHOW_LAYERS_PANEL, Task.SHOW_PROPERTIES_PANEL]);

  // api.runAtNextTick(() => {
  // const node = {
  //   id: '1',
  //   type: 'ellipse',
  //   fill: 'red',
  //   x: 0,
  //   y: 50,
  //   width: 200,
  //   height: 100,
  //   visibility: 'visible',
  // };
  // api.updateNodes([node]);
  // api.selectNodes([node]);
  // });

  api.updateNodes(nodes);

  // api.gotoLandmark(
  //   api.createLandmark({
  //     x: camera.x,
  //     y: camera.y,
  //     zoom: camera.zoom,
  //   }),
  //   { duration: 100 },
  // );
  // });
  // api.updateNodes(nodes);
  // api.selectNodes([nodes[0]]);

  // console.log(nodes);

  api.record();
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
