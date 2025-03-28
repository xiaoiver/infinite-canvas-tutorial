import {
  App,
  svgElementsToSerializedNodes,
  DefaultPlugins,
  CheckboardStyle,
} from '../../ecs';
import { Event, UIPlugin } from '../src';
import '../src/spectrum';

const res = await fetch('/maslow-hierarchy.svg');
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
  api.updateNodes(nodes);
});

const app = new App().addPlugins(...DefaultPlugins, UIPlugin);
app.run();
