import _gl from 'gl';
import { JSDOM } from 'jsdom';
import xmlserializer from 'xmlserializer';
import { getCanvas } from '../utils';
import '../useSnapshotMatchers';
import { Canvas, ImageExporter, RoughPolyline } from '../../packages/core/src';

const dir = `${__dirname}/snapshots`;
let $canvas: HTMLCanvasElement;
let canvas: Canvas;
let exporter: ImageExporter;

describe('RoughPolyline', () => {
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

  it('should render a rough polyline correctly.', async () => {
    const polyline = new RoughPolyline({
      points: [
        [50, 50],
        [50, 150],
        [150, 50],
      ],
      stroke: 'black',
      strokeWidth: 2,
      fill: 'none',
    });
    canvas.appendChild(polyline);
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'rough-polyline',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'rough-polyline',
    );
  });

  // it('should render a rough polyline with stroke dasharray correctly.', async () => {
  //   const polyline1 = new RoughPolyline({
  //     points: [
  //       [50, 50],
  //       [50, 150],
  //       [100, 150],
  //       [100, 50],
  //     ],
  //     stroke: 'black',
  //     strokeWidth: 2,
  //     strokeDasharray: [10, 10],
  //     fill: 'none',
  //   });
  //   canvas.appendChild(polyline1);

  //   const polyline2 = new RoughPolyline({
  //     points: [
  //       [150, 50],
  //       [150, 150],
  //       [200, 150],
  //       [200, 50],
  //     ],
  //     stroke: 'black',
  //     strokeWidth: 2,
  //     strokeDasharray: [10, 10],
  //     strokeDashoffset: 10,
  //     fill: 'none',
  //   });
  //   canvas.appendChild(polyline2);

  //   canvas.render();

  //   expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
  //     dir,
  //     'rough-polyline-stroke-dasharray',
  //   );
  //   expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
  //     dir,
  //     'rough-polyline-stroke-dasharray',
  //   );
  // });
});
