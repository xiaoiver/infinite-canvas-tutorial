import { Canvas, Rect } from '../../../../packages/core/src';
import { ImageLoader } from '@loaders.gl/images';
import { load } from '@loaders.gl/core';

export async function render(canvas: Canvas) {
  const image = (await load('./canvas.png', ImageLoader)) as ImageBitmap;

  const rect1 = new Rect({
    x: 50,
    y: 50,
    width: 100,
    height: 100,
    fill: 'black',
  });
  canvas.appendChild(rect1);

  const rect2 = new Rect({
    x: 150,
    y: 50,
    width: 100,
    height: 100,
    fill: 'black',
    opacity: 0.5,
  });
  canvas.appendChild(rect2);

  const rect3 = new Rect({
    x: 250,
    y: 50,
    width: 100,
    height: 100,
    fill: 'black',
    stroke: 'red',
    strokeWidth: 20,
    strokeOpacity: 0.5,
  });
  canvas.appendChild(rect3);

  const rect4 = new Rect({
    x: 50,
    y: 150,
    width: 100,
    height: 100,
    fill: 'black',
    stroke: 'red',
    strokeWidth: 20,
    strokeOpacity: 0.5,
  });
  canvas.appendChild(rect4);

  const rect5 = new Rect({
    x: 150,
    y: 150,
    width: 100,
    height: 100,
    fill: 'black',
    stroke: 'red',
    strokeWidth: 20,
    strokeOpacity: 0.5,
    strokeAlignment: 'inner',
  });
  canvas.appendChild(rect5);

  const rect6 = new Rect({
    x: 250,
    y: 150,
    width: 100,
    height: 100,
    fill: 'black',
    stroke: 'red',
    strokeWidth: 20,
    strokeOpacity: 0.5,
    strokeAlignment: 'outer',
  });
  canvas.appendChild(rect6);

  const rect7 = new Rect({
    x: 50,
    y: 250,
    width: 100,
    height: 100,
    fill: image,
    stroke: 'red',
    strokeWidth: 20,
    strokeOpacity: 0.5,
  });
  canvas.appendChild(rect7);

  const rect8 = new Rect({
    x: 150,
    y: 250,
    width: 100,
    height: 100,
    fill: image,
    stroke: 'red',
    strokeWidth: 20,
    strokeOpacity: 0.5,
    strokeAlignment: 'inner',
  });
  canvas.appendChild(rect8);

  const rect9 = new Rect({
    x: 250,
    y: 250,
    width: 100,
    height: 100,
    fill: image,
    stroke: 'red',
    strokeWidth: 20,
    strokeOpacity: 0.5,
    strokeAlignment: 'outer',
  });
  canvas.appendChild(rect9);

  canvas.render();
}
