import { Canvas, Ellipse } from '../../../../packages/core/src';
import { ImageLoader } from '@loaders.gl/images';
import { load } from '@loaders.gl/core';

export async function render(canvas: Canvas) {
  const image = (await load('./canvas.png', ImageLoader)) as ImageBitmap;

  const ellipse1 = new Ellipse({
    cx: 100,
    cy: 100,
    rx: 50,
    ry: 30,
    fill: 'black',
  });
  canvas.appendChild(ellipse1);

  const ellipse2 = new Ellipse({
    cx: 200,
    cy: 100,
    rx: 50,
    ry: 30,
    fill: 'black',
    opacity: 0.5,
  });
  canvas.appendChild(ellipse2);

  const ellipse3 = new Ellipse({
    cx: 300,
    cy: 100,
    rx: 50,
    ry: 30,
    fill: 'black',
    stroke: 'red',
    strokeWidth: 20,
    strokeOpacity: 0.5,
  });
  canvas.appendChild(ellipse3);

  const ellipse4 = new Ellipse({
    cx: 100,
    cy: 200,
    rx: 50,
    ry: 30,
    fill: 'black',
    stroke: 'red',
    strokeWidth: 20,
    strokeOpacity: 0.5,
  });
  canvas.appendChild(ellipse4);

  const ellipse5 = new Ellipse({
    cx: 200,
    cy: 200,
    rx: 50,
    ry: 30,
    fill: 'black',
    stroke: 'red',
    strokeWidth: 20,
    strokeOpacity: 0.5,
    strokeAlignment: 'inner',
  });
  canvas.appendChild(ellipse5);

  const ellipse6 = new Ellipse({
    cx: 300,
    cy: 200,
    rx: 50,
    ry: 30,
    fill: 'black',
    stroke: 'red',
    strokeWidth: 20,
    strokeOpacity: 0.5,
    strokeAlignment: 'outer',
  });
  canvas.appendChild(ellipse6);

  const ellipse7 = new Ellipse({
    cx: 100,
    cy: 300,
    rx: 50,
    ry: 30,
    fill: image,
    stroke: 'red',
    strokeWidth: 20,
    strokeOpacity: 0.5,
  });
  canvas.appendChild(ellipse7);

  const ellipse8 = new Ellipse({
    cx: 200,
    cy: 300,
    rx: 50,
    ry: 30,
    fill: image,
    stroke: 'red',
    strokeWidth: 20,
    strokeOpacity: 0.5,
    strokeAlignment: 'inner',
  });
  canvas.appendChild(ellipse8);

  const ellipse9 = new Ellipse({
    cx: 300,
    cy: 300,
    rx: 50,
    ry: 30,
    fill: image,
    stroke: 'red',
    strokeWidth: 20,
    strokeOpacity: 0.5,
    strokeAlignment: 'outer',
  });
  canvas.appendChild(ellipse9);

  canvas.render();
}
