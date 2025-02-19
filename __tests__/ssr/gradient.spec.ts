import _gl from 'gl';
import { NodeJSAdapter } from '../utils';
import '../useSnapshotMatchers';
import {
  Canvas,
  DOMAdapter,
  ImageExporter,
  Rect,
} from '../../packages/core/src';

const dir = `${__dirname}/snapshots`;
let $canvas: HTMLCanvasElement;
let canvas: Canvas;
let exporter: ImageExporter;

DOMAdapter.set(NodeJSAdapter);

describe('Gradient', () => {
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

  it('should render linear gradient correctly.', async () => {
    const rect = new Rect({
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      fill: 'linear-gradient(to right, red, blue)',
    });
    canvas.appendChild(rect);
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'linear-gradient',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'linear-gradient',
    );
  });

  it('should render radial gradient correctly.', async () => {
    const rect = new Rect({
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      fill: 'radial-gradient(circle at center, red, blue, green 100%)',
    });
    canvas.appendChild(rect);
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'radial-gradient',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'radial-gradient',
    );
  });
});
