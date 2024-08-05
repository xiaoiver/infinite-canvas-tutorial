import _gl from 'gl';
import { getCanvas } from '../utils';
import '../useSnapshotMatchers';
import { Canvas, Rect } from '../../packages/core/src';

describe('Rect', () => {
  it('should render a simple rect correctly.', async () => {
    const $canvas = getCanvas(200, 200);

    const canvas = await new Canvas({
      canvas: $canvas,
    }).initialized;
    const rect = new Rect({
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      fill: 'black',
    });
    canvas.appendChild(rect);
    canvas.render();

    const dir = `${__dirname}/snapshots`;

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(dir, 'rect');

    canvas.destroy();
  });

  it('should render a rect with drop shadow correctly.', async () => {
    const $canvas = getCanvas(200, 200);

    const canvas = await new Canvas({
      canvas: $canvas,
    }).initialized;

    const rect = new Rect({
      x: 50,
      y: 50,
      width: 50,
      height: 50,
      fill: 'black',
      dropShadowBlurRadius: 10,
      dropShadowColor: 'black',
      dropShadowOffsetX: 10,
      dropShadowOffsetY: 10,
    });
    canvas.appendChild(rect);

    const rect2 = new Rect({
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      fill: 'black',
      dropShadowBlurRadius: 10,
      dropShadowColor: 'black',
      dropShadowOffsetX: 10,
      dropShadowOffsetY: 10,
      batchable: false,
    });
    canvas.appendChild(rect2);

    const rect3 = new Rect({
      x: 100,
      y: 50,
      width: 20,
      height: 20,
      fill: 'black',
      dropShadowBlurRadius: 8,
      dropShadowColor: 'black',
    });
    canvas.appendChild(rect3);

    canvas.render();

    const dir = `${__dirname}/snapshots`;

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'rect-dropshadow',
    );

    canvas.destroy();
  });
});
