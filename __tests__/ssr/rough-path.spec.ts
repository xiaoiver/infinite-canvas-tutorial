import _gl from 'gl';
import { NodeJSAdapter } from '../utils';
import '../useSnapshotMatchers';
import {
  Canvas,
  DOMAdapter,
  ImageExporter,
  RoughPath,
} from '../../packages/core/src';

const dir = `${__dirname}/snapshots`;
let $canvas: HTMLCanvasElement;
let canvas: Canvas;
let exporter: ImageExporter;

DOMAdapter.set(NodeJSAdapter);

describe('RoughPath', () => {
  beforeEach(async () => {
    $canvas = DOMAdapter.get().createCanvas(200, 200) as HTMLCanvasElement;
    canvas = await new Canvas({
      canvas: $canvas,
    }).initialized;
    exporter = new ImageExporter({
      canvas,
    });
  });

  afterEach(() => {
    canvas.destroy();
  });

  it('should render a rough path correctly.', async () => {
    const path = new RoughPath({
      d: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
      fill: '#F67676',
    });
    canvas.appendChild(path);
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'rough-path',
      {
        maxError: 1000,
      },
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'rough-path',
    );
  });

  it('should render a rough path with transform correctly.', async () => {
    const path = new RoughPath({
      d: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
      fill: '#F67676',
    });
    canvas.appendChild(path);

    path.position.x = 50;
    path.position.y = 50;
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'rough-path-transform',
      {
        maxError: 1000,
      },
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'rough-path-transform',
    );
  });
});
