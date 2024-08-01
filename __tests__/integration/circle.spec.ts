import _gl from 'gl';
import { getCanvas, sleep } from '../utils';
import '../useSnapshotMatchers';
import { Canvas, Circle } from '../../packages/core/src';

describe('Circle', () => {
  it('should render correctly.', async () => {
    const $canvas = getCanvas(200, 200);

    const canvas = await new Canvas({
      canvas: $canvas,
      backgroundColor: 'red',
    }).initialized;
    const circle = new Circle({
      cx: 50,
      cy: 50,
      r: 50,
      fill: 'black',
    });
    canvas.appendChild(circle);
    canvas.render();

    await sleep(300);

    const dir = `${__dirname}/snapshots`;

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(dir, 'circle');
  });
});
