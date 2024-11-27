import _gl from 'gl';
import { JSDOM } from 'jsdom';
import xmlserializer from 'xmlserializer';
// import getPixels from 'get-pixels';
import { getCanvas } from '../utils';
import '../useSnapshotMatchers';
import { Canvas, ImageExporter, Polyline } from '../../packages/core/src';

const dir = `${__dirname}/snapshots`;
let $canvas: HTMLCanvasElement;
let canvas: Canvas;
let exporter: ImageExporter;

describe('Polyline', () => {
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

  it('should render a simple polyline correctly.', async () => {
    const polyline = new Polyline({
      points: [
        [50, 50],
        [50, 150],
        [150, 50],
      ],
      stroke: 'black',
      strokeWidth: 20,
      fill: 'none',
    });
    canvas.appendChild(polyline);
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(dir, 'polyline');
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(dir, 'polyline');
  });

  it('should render a polyline with stroke linejoin & linecap correctly.', async () => {
    const polyline1 = new Polyline({
      points: [
        [50, 50],
        [50, 150],
        [100, 150],
        [100, 50],
      ],
      stroke: 'black',
      strokeWidth: 20,
      strokeLinejoin: 'round',
      fill: 'none',
    });
    canvas.appendChild(polyline1);

    const polyline2 = new Polyline({
      points: [
        [120, 50],
        [120, 150],
        [170, 150],
        [170, 50],
      ],
      stroke: 'black',
      strokeWidth: 20,
      strokeLinejoin: 'round',
      strokeLinecap: 'round',
      fill: 'none',
    });
    canvas.appendChild(polyline2);

    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'polyline-stroke-linejoin',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'polyline-stroke-linejoin',
    );
  });

  it('should render a polyline with stroke alignment correctly.', async () => {
    const polyline1 = new Polyline({
      points: [
        [50, 50],
        [50, 150],
        [100, 150],
        [100, 50],
      ],
      stroke: 'black',
      strokeWidth: 20,
      strokeAlignment: 'outer',
      fill: 'none',
    });
    canvas.appendChild(polyline1);
    const polyline4 = new Polyline({
      points: [
        [50, 50],
        [50, 150],
        [100, 150],
        [100, 50],
      ],
      stroke: 'red',
      strokeWidth: 2,
      fill: 'none',
    });
    canvas.appendChild(polyline4);

    const polyline2 = new Polyline({
      points: [
        [120, 50],
        [120, 150],
        [170, 150],
        [170, 50],
      ],
      stroke: 'black',
      strokeWidth: 20,
      fill: 'none',
    });
    canvas.appendChild(polyline2);
    const polyline5 = new Polyline({
      points: [
        [120, 50],
        [120, 150],
        [170, 150],
        [170, 50],
      ],
      stroke: 'red',
      strokeWidth: 2,
      fill: 'none',
    });
    canvas.appendChild(polyline5);

    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'polyline-stroke-alignment',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'polyline-stroke-alignment',
    );
  });

  it('should render a polyline with stroke dasharray correctly.', async () => {
    const polyline1 = new Polyline({
      points: [
        [50, 50],
        [50, 150],
        [100, 150],
        [100, 50],
      ],
      stroke: 'black',
      strokeWidth: 20,
      strokeDasharray: [10, 10],
      fill: 'none',
    });
    canvas.appendChild(polyline1);

    const polyline2 = new Polyline({
      points: [
        [150, 50],
        [150, 150],
        [200, 150],
        [200, 50],
      ],
      stroke: 'black',
      strokeWidth: 20,
      strokeDasharray: [10, 10],
      strokeDashoffset: 10,
      fill: 'none',
    });
    canvas.appendChild(polyline2);

    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'polyline-stroke-dasharray',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'polyline-stroke-dasharray',
    );
  });

  it('should rerender correctly when points is changed.', async () => {
    const polyline1 = new Polyline({
      points: [
        [50, 50],
        [50, 150],
        [100, 150],
        [100, 50],
      ],
      stroke: 'black',
      strokeWidth: 20,
      strokeDasharray: [10, 10],
      fill: 'none',
    });
    canvas.appendChild(polyline1);
    canvas.render();

    polyline1.points = [
      [50, 50],
      [50, 150],
    ];
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'polyline-points-changed',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'polyline-points-changed',
    );
  });
});
