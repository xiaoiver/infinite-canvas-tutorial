import _gl from 'gl';
import { getCanvas } from '../utils';
import '../useSnapshotMatchers';
import { Canvas } from '../../packages/core/src';
import { CheckboardStyle } from '../../packages/core/src/plugins';

describe('Grid', () => {
  it('should render lines grid correctly.', async () => {
    const $canvas = getCanvas(200, 200);

    const canvas = await new Canvas({
      canvas: $canvas,
      backgroundColor: 'white',
      gridColor: 'gray',
    }).initialized;
    canvas.render();

    const dir = `${__dirname}/snapshots`;

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'grid-lines',
    );

    canvas.destroy();
  });

  it('should render dots grid correctly.', async () => {
    const $canvas = getCanvas(200, 200);

    const canvas = await new Canvas({
      canvas: $canvas,
      backgroundColor: 'white',
      gridColor: 'gray',
    }).initialized;
    canvas.checkboardStyle = CheckboardStyle.DOTS;
    canvas.render();

    const dir = `${__dirname}/snapshots`;

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(dir, 'grid-dots');

    canvas.destroy();
  });

  it('should render none grid correctly.', async () => {
    const $canvas = getCanvas(200, 200);

    const canvas = await new Canvas({
      canvas: $canvas,
      backgroundColor: 'white',
      gridColor: 'gray',
    }).initialized;
    canvas.checkboardStyle = CheckboardStyle.NONE;
    canvas.render();

    const dir = `${__dirname}/snapshots`;

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(dir, 'grid-none');

    canvas.destroy();
  });
});
