import _gl from 'gl';
import { JSDOM } from 'jsdom';
import xmlserializer from 'xmlserializer';
import { getCanvas, sleep } from '../utils';
import '../useSnapshotMatchers';
import { Canvas, ImageExporter, Rect } from '../../packages/core/src';

const dir = `${__dirname}/snapshots`;
let $canvas: HTMLCanvasElement;
let canvas: Canvas;
let exporter: ImageExporter;

describe('Z index', () => {
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

  it('should account for z-index correctly.', async () => {
    const rect1 = new Rect({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fill: 'red',
      zIndex: 2,
    });
    canvas.appendChild(rect1);

    const rect2 = new Rect({
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      fill: 'green',
      zIndex: 1,
    });
    canvas.appendChild(rect2);

    const rect3 = new Rect({
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      fill: 'blue',
    });
    canvas.appendChild(rect3);
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(dir, 'z-index');
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(dir, 'z-index');

    await sleep(300);

    canvas.removeChild(rect1);
    canvas.render();
    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'z-index-remove',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'z-index-remove',
    );

    await sleep(300);
    canvas.appendChild(rect1);
    rect1.zIndex = -1;
    canvas.render();
    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'z-index-append',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'z-index-append',
    );
  });
});
