import { Canvas, Circle } from '../../../../packages/core/src';
import { ImageLoader } from '@loaders.gl/images';
import { load } from '@loaders.gl/core';

export async function render(canvas: Canvas) {
  const image = (await load('./canvas.png', ImageLoader)) as ImageBitmap;

  const circle1 = new Circle({
    cx: 100,
    cy: 100,
    r: 50,
    fill: 'black',
  });
  canvas.appendChild(circle1);

  const circle2 = new Circle({
    cx: 200,
    cy: 100,
    r: 50,
    fill: 'black',
    opacity: 0.5,
  });
  canvas.appendChild(circle2);

  const circle3 = new Circle({
    cx: 300,
    cy: 100,
    r: 50,
    fill: 'black',
    stroke: 'red',
    strokeWidth: 20,
    strokeOpacity: 0.5,
  });
  canvas.appendChild(circle3);

  const circle4 = new Circle({
    cx: 100,
    cy: 200,
    r: 50,
    fill: 'black',
    stroke: 'red',
    strokeWidth: 20,
    strokeOpacity: 0.5,
  });
  canvas.appendChild(circle4);

  const circle5 = new Circle({
    cx: 200,
    cy: 200,
    r: 50,
    fill: 'black',
    stroke: 'red',
    strokeWidth: 20,
    strokeOpacity: 0.5,
    strokeAlignment: 'inner',
  });
  canvas.appendChild(circle5);

  const circle6 = new Circle({
    cx: 300,
    cy: 200,
    r: 50,
    fill: 'black',
    stroke: 'red',
    strokeWidth: 20,
    strokeOpacity: 0.5,
    strokeAlignment: 'outer',
  });
  canvas.appendChild(circle6);

  const circle7 = new Circle({
    cx: 100,
    cy: 300,
    r: 50,
    fill: image,
    stroke: 'red',
    strokeWidth: 20,
    strokeOpacity: 0.5,
  });
  canvas.appendChild(circle7);

  const circle8 = new Circle({
    cx: 200,
    cy: 300,
    r: 50,
    fill: image,
    stroke: 'red',
    strokeWidth: 20,
    strokeOpacity: 0.5,
    strokeAlignment: 'inner',
  });
  canvas.appendChild(circle8);

  const circle9 = new Circle({
    cx: 300,
    cy: 300,
    r: 50,
    fill: image,
    stroke: 'red',
    strokeWidth: 20,
    strokeOpacity: 0.5,
    strokeAlignment: 'outer',
  });
  canvas.appendChild(circle9);

  canvas.render();
}
