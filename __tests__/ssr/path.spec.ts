import _gl from 'gl';
import { JSDOM } from 'jsdom';
import xmlserializer from 'xmlserializer';
// import getPixels from 'get-pixels';
import { getCanvas } from '../utils';
import '../useSnapshotMatchers';
import {
  Canvas,
  ImageExporter,
  Path,
  TesselationMethod,
} from '../../packages/core/src';

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

  it('should render holes correctly.', async () => {
    const path = new Path({
      d: 'M 0 0 L 100 0 L 100 100 L 0 100 Z M 50 50 L 50 75 L 75 75 L 75 50 Z M 25 25 L 25 50 L 50 50 Z',
      fill: '#F67676',
    });
    canvas.appendChild(path);
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'path-holes',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'path-holes',
    );
  });

  it('should use libtess TesselationMethod correctly.', async () => {
    const path = new Path({
      d: 'M 0 0 L 100 0 L 100 100 L 0 100 Z M 50 50 L 50 75 L 75 75 L 75 50 Z M 25 25 L 25 50 L 50 50 Z',
      fill: '#F67676',
      tessellationMethod: TesselationMethod.LIBTESS,
    });
    canvas.appendChild(path);
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'path-holes-libtess',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'path-holes-libtess',
    );
  });
});
