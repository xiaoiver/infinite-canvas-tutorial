import _gl from 'gl';
import { NodeJSAdapter } from '../utils';
import '../useSnapshotMatchers';
import { Canvas, Circle, DOMAdapter } from '../../packages/core/src';

const dir = `${__dirname}/snapshots`;
let $canvas: HTMLCanvasElement;
let canvas: Canvas;

DOMAdapter.set(NodeJSAdapter);

describe('Wireframe', () => {
  beforeEach(async () => {
    $canvas = DOMAdapter.get().createCanvas(200, 200) as HTMLCanvasElement;
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

    await new Promise((resolve) => setTimeout(resolve, 300));

    circle.position.x = 100;
    circle.position.y = 100;
    circle.cx = 0;
    circle.cy = 0;
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'wireframe-2',
    );
  });
});
