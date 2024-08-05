import _gl from 'gl';
import { getCanvas } from '../utils';
import '../useSnapshotMatchers';
import { Canvas, Circle } from '../../packages/core/src';

describe('Batch Rendering', () => {
  it('should render a batchable and anon-batchable circle separately.', async () => {
    const $canvas = getCanvas(200, 200);

    const canvas = await new Canvas({
      canvas: $canvas,
    }).initialized;
    const circle1 = new Circle({
      cx: 50,
      cy: 50,
      r: 50,
      fill: 'black',
      batchable: false,
    });
    canvas.appendChild(circle1);
    const circle2 = new Circle({
      cx: 150,
      cy: 50,
      r: 50,
      fill: 'black',
    });
    canvas.appendChild(circle2);
    canvas.render();

    const dir = `${__dirname}/snapshots`;

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(dir, 'batch');

    canvas.destroy();
  });
});
