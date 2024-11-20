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

describe('Visibility', () => {
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

  it('should account for visibility correctly.', async () => {
    const rect1 = new Rect({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fill: 'red',
      visible: false,
    });
    canvas.appendChild(rect1);

    const rect2 = new Rect({
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      fill: 'green',
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

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'visibility',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'visibility',
    );
    await sleep(300);

    rect1.visible = true;
    canvas.render();
    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'visibility-show',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'visibility-show',
    );
    await sleep(300);

    rect1.visible = false;
    canvas.render();
    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'visibility-hide',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'visibility-hide',
    );
  });
});
