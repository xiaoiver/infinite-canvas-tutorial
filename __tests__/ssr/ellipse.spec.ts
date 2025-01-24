import _gl from 'gl';
import '../useSnapshotMatchers';
import {
  Canvas,
  DOMAdapter,
  Ellipse,
  ImageExporter,
} from '../../packages/core/src';
import { NodeJSAdapter } from '../utils';

DOMAdapter.set(NodeJSAdapter);

const dir = `${__dirname}/snapshots`;
let $canvas: HTMLCanvasElement;
let canvas: Canvas;
let exporter: ImageExporter;

describe('Ellipse', () => {
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

  it('should render a simple ellipse correctly.', async () => {
    const ellipse = new Ellipse({
      cx: 100,
      cy: 100,
      rx: 50,
      ry: 80,
      fill: 'black',
    });
    canvas.appendChild(ellipse);
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(dir, 'ellipse');
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(dir, 'ellipse');
  });

  it('should render a ellipse with stroke dasharray correctly.', async () => {
    const ellipse = new Ellipse({
      cx: 100,
      cy: 100,
      rx: 100,
      ry: 50,
      fill: 'red',
      stroke: 'black',
      strokeOpacity: 0.5,
      strokeWidth: 20,
      strokeDasharray: [5, 5],
    });
    canvas.appendChild(ellipse);

    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'ellipse-stroke-dasharray',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'ellipse-stroke-dasharray',
    );
  });
});
