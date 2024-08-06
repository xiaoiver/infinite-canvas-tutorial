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

describe('Scenegraph', () => {
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

  it('should construct a scenegraph correctly.', async () => {
    const parent = new Rect({
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      fill: 'black',
    });
    canvas.appendChild(parent);

    const child = new Rect({
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      fill: 'red',
    });
    parent.appendChild(child);

    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'scenegraph',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'scenegraph',
    );
  });

  it('should apply transform on scenegraph correctly.', async () => {
    const parent = new Rect({
      width: 100,
      height: 100,
      fill: 'black',
    });
    parent.position = { x: 50, y: 50 };
    canvas.appendChild(parent);

    const child = new Rect({
      width: 50,
      height: 50,
      fill: 'red',
    });
    child.position = { x: 50, y: 50 };
    parent.appendChild(child);

    canvas.render();
    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'scenegraph-transform-translate',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'scenegraph-transform-translate',
    );

    await sleep(300);

    parent.pivot = { x: 50, y: 50 };
    parent.scale.x = 0.5;
    parent.scale.y = 0.5;
    canvas.render();
    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'scenegraph-transform-scale',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'scenegraph-transform-scale',
    );

    await sleep(300);
    parent.scale.x = 1;
    parent.scale.y = 1;
    parent.rotation = Math.PI / 4;
    canvas.render();
    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'scenegraph-transform-rotation',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'scenegraph-transform-rotation',
    );
  });
});
