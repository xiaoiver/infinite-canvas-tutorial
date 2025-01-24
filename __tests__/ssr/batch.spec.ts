import _gl from 'gl';
import '../useSnapshotMatchers';
import { Canvas, Circle, DOMAdapter } from '../../packages/core/src';
import { NodeJSAdapter } from '../utils';

DOMAdapter.set(NodeJSAdapter);

describe('Batch Rendering', () => {
  it('should render a batchable and anon-batchable circle separately.', async () => {
    const $canvas = DOMAdapter.get().createCanvas(
      200,
      200,
    ) as HTMLCanvasElement;

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
