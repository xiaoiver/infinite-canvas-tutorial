import _gl from 'gl';
import { JSDOM } from 'jsdom';
import xmlserializer from 'xmlserializer';
import { getCanvas } from '../utils';
import '../useSnapshotMatchers';
import { Canvas, Ellipse, ImageExporter } from '../../packages/core/src';

const dir = `${__dirname}/snapshots`;
let $canvas: HTMLCanvasElement;
let canvas: Canvas;
let exporter: ImageExporter;

describe('Ellipse', () => {
  beforeEach(async () => {
    $canvas = getCanvas(200, 200);
    canvas = await new Canvas({
      canvas: $canvas,
    }).initialized;
    exporter = new ImageExporter({
      canvas,
      document: new JSDOM().window._document,
      xmlserializer,
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
