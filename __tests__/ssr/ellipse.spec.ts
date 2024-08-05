import _gl from 'gl';
import { getCanvas } from '../utils';
import '../useSnapshotMatchers';
import { Canvas, Ellipse } from '../../packages/core/src';

describe('Ellipse', () => {
  it('should render a simple ellipse correctly.', async () => {
    const $canvas = getCanvas(200, 200);

    const canvas = await new Canvas({
      canvas: $canvas,
    }).initialized;
    const ellipse = new Ellipse({
      cx: 100,
      cy: 100,
      rx: 50,
      ry: 80,
      fill: 'black',
    });
    canvas.appendChild(ellipse);
    canvas.render();

    const dir = `${__dirname}/snapshots`;

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(dir, 'ellipse');

    canvas.destroy();
  });
});
