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
    dropShadowBlurRadius: 10,
    dropShadowColor: 'red',
    dropShadowOffsetX: 10,
    dropShadowOffsetY: 10,
  });
  canvas.appendChild(rect1);

  const rect2 = new Rect({
    x: 200,
    y: 50,
    width: 100,
    height: 100,
    fill: 'black',
    stroke: 'black',
    strokeWidth: 10,
    strokeOpacity: 0.5,
    dropShadowBlurRadius: 10,
    dropShadowColor: 'red',
  });
  canvas.appendChild(rect2);

  const rect3 = new Rect({
    x: 50,
    y: 250,
    width: 100,
    height: 100,
    fill: image,
    stroke: 'black',
    strokeWidth: 10,
    strokeOpacity: 0.5,
    dropShadowBlurRadius: 10,
    dropShadowColor: 'red',
  });
  canvas.appendChild(rect3);

  canvas.render();
}
