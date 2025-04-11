import {
  App,
  svgElementsToSerializedNodes,
  DefaultPlugins,
  Pen,
} from '../../ecs';
import { Event, UIPlugin, Task } from '../src';
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
  api.setPen(Pen.SELECT);
  api.setTaskbars([Task.SHOW_LAYERS_PANEL, Task.SHOW_PROPERTIES_PANEL]);

  api.updateNodes(nodes);
  api.selectNodes([nodes[0].id]);
});

const app = new App().addPlugins(...DefaultPlugins, UIPlugin);
app.run();
