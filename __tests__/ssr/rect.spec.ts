import _gl from 'gl';
import { JSDOM } from 'jsdom';
import xmlserializer from 'xmlserializer';
import { getCanvas } from '../utils';
import '../useSnapshotMatchers';
import { Canvas, ImageExporter, Rect } from '../../packages/core/src';

const dir = `${__dirname}/snapshots`;
let $canvas: HTMLCanvasElement;
let canvas: Canvas;
let exporter: ImageExporter;

describe('Rect', () => {
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

  it('should render a simple rect correctly.', async () => {
    const rect = new Rect({
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      fill: 'black',
    });
    canvas.appendChild(rect);
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(dir, 'rect');
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(dir, 'rect');
  });

  it('should render a rect with drop shadow correctly.', async () => {
    const rect = new Rect({
      x: 50,
      y: 50,
      width: 50,
      height: 50,
      fill: 'black',
      dropShadowBlurRadius: 10,
      dropShadowColor: 'black',
      dropShadowOffsetX: 10,
      dropShadowOffsetY: 10,
    });
    canvas.appendChild(rect);

    const rect2 = new Rect({
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      fill: 'black',
      dropShadowBlurRadius: 10,
      dropShadowColor: 'black',
      dropShadowOffsetX: 10,
      dropShadowOffsetY: 10,
      batchable: false,
    });
    canvas.appendChild(rect2);

    const rect3 = new Rect({
      x: 100,
      y: 50,
      width: 20,
      height: 20,
      fill: 'black',
      dropShadowBlurRadius: 8,
      dropShadowColor: 'black',
    });
    canvas.appendChild(rect3);

    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'rect-dropshadow',
    );
  });
});
