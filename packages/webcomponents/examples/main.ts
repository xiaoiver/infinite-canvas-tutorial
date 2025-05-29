import {
  App,
  svgElementsToSerializedNodes,
  DefaultPlugins,
  Pen,
  Task,
} from '../../ecs';
import { Event, UIPlugin } from '../src';
import '../src/spectrum';

const res = await fetch('/maslow-hierarchy.svg');
// const res = await fetch('/test.svg');
const svg = await res.text();
// TODO: extract semantic groups inside comments
const $container = document.createElement('div');
$container.innerHTML = svg;
const $svg = $container.children[0] as SVGSVGElement;

const nodes = svgElementsToSerializedNodes(
  Array.from($svg.children) as SVGElement[],
  0,
  [],
  undefined,
);

const canvas = document.querySelector<HTMLElement>('#canvas1')!;
canvas.addEventListener(Event.READY, (e) => {
  const api = e.detail;

  // api.onchange = (e) => {
  //   console.log(e);
  // };

  api.setPen(Pen.SELECT);
  // api.setTaskbars([Task.SHOW_LAYERS_PANEL, Task.SHOW_PROPERTIES_PANEL]);

  api.updateNodes(nodes);
  api.selectNodes([nodes[0]]);

  console.log(nodes[0]);

  // api.updateNode(nodes[0], {
  //   dropShadowBlurRadius: 10,
  //   dropShadowColor: 'black',
  //   dropShadowOffsetX: 10,
  //   dropShadowOffsetY: 10,
  // });

  api.record();
});

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

const app = new App().addPlugins(...DefaultPlugins, UIPlugin);
app.run();
