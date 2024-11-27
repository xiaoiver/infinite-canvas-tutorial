import _gl from 'gl';
import { JSDOM } from 'jsdom';
import xmlserializer from 'xmlserializer';
// import getPixels from 'get-pixels';
import { getCanvas } from '../utils';
import '../useSnapshotMatchers';
import { Canvas, ImageExporter, Path } from '../../packages/core/src';

const dir = `${__dirname}/snapshots`;
let $canvas: HTMLCanvasElement;
let canvas: Canvas;
let exporter: ImageExporter;

describe('Path', () => {
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

  it('should render a simple path correctly.', async () => {
    const path = new Path({
      d: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
      fill: '#F67676',
    });
    canvas.appendChild(path);
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(dir, 'path');
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(dir, 'path');
  });

  it('should rerender correctly when d is changed.', async () => {
    const path = new Path({
      d: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
      fill: '#F67676',
    });
    canvas.appendChild(path);
    canvas.render();

    path.d = 'M 0 0 L 50 0 L 100 100 Z';
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'path-d-changed',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'path-d-changed',
    );
  });
});
