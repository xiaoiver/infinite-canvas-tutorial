import _gl from 'gl';
import { NodeJSAdapter } from '../utils';
import '../useSnapshotMatchers';
import { Canvas, DOMAdapter, ImageExporter } from '../../packages/core/src';
import { CheckboardStyle } from '../../packages/core/src/plugins';

const dir = `${__dirname}/snapshots`;
let $canvas: HTMLCanvasElement;
let canvas: Canvas;
let exporter: ImageExporter;

DOMAdapter.set(NodeJSAdapter);

describe('Grid', () => {
  beforeEach(async () => {
    $canvas = DOMAdapter.get().createCanvas(200, 200) as HTMLCanvasElement;
    canvas = await new Canvas({
      canvas: $canvas,
      backgroundColor: 'white',
      gridColor: 'gray',
    }).initialized;
    exporter = new ImageExporter({
      canvas,
    });
  });

  afterEach(() => {
    canvas.destroy();
  });

  it('should render lines grid correctly.', async () => {
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'grid-lines',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'grid-lines',
    );
  });

  it('should render dots grid correctly.', async () => {
    canvas.checkboardStyle = CheckboardStyle.DOTS;
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(dir, 'grid-dots');
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(dir, 'grid-dots');
  });

  it('should render none grid correctly.', async () => {
    canvas.checkboardStyle = CheckboardStyle.NONE;
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(dir, 'grid-none');
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(dir, 'grid-none');
  });
});
