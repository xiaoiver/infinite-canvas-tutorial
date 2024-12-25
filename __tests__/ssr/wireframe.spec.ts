import _gl from 'gl';
import { getCanvas } from '../utils';
import '../useSnapshotMatchers';
import { Canvas, Circle } from '../../packages/core/src';

const dir = `${__dirname}/snapshots`;
let $canvas: HTMLCanvasElement;
let canvas: Canvas;

describe('Wireframe', () => {
  beforeEach(async () => {
    $canvas = getCanvas(200, 200);
    canvas = await new Canvas({
      canvas: $canvas,
    }).initialized;
  });

  afterEach(() => {
    canvas.destroy();
  });

  it('should render wireframe for circle correctly.', async () => {
    const circle = new Circle({
      cx: 100,
      cy: 100,
      r: 50,
      fill: 'grey',
      wireframe: true,
    });
    canvas.appendChild(circle);
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(dir, 'wireframe');
  });
});
