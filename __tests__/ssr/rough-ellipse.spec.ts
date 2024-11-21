import _gl from 'gl';
import { JSDOM } from 'jsdom';
import xmlserializer from 'xmlserializer';
import { getCanvas } from '../utils';
import '../useSnapshotMatchers';
import {
  Canvas,
  Ellipse,
  ImageExporter,
  RoughEllipse,
} from '../../packages/core/src';

const dir = `${__dirname}/snapshots`;
let $canvas: HTMLCanvasElement;
let canvas: Canvas;
let exporter: ImageExporter;

describe('RoughEllipse', () => {
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

  it('should render a rough ellipse correctly.', async () => {
    const ellipse = new RoughEllipse({
      cx: 100,
      cy: 100,
      rx: 50,
      ry: 80,
      fill: 'black',
      stroke: 'red',
    });
    canvas.appendChild(ellipse);
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'rough-ellipse',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'rough-ellipse',
    );
  });
});
