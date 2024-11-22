import _gl from 'gl';
import { JSDOM } from 'jsdom';
import xmlserializer from 'xmlserializer';
import { getCanvas } from '../utils';
import '../useSnapshotMatchers';
import { Canvas, ImageExporter, RoughRect } from '../../packages/core/src';

const dir = `${__dirname}/snapshots`;
let $canvas: HTMLCanvasElement;
let canvas: Canvas;
let exporter: ImageExporter;

describe('RoughRect', () => {
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

  it('should render a simple rough rect correctly.', async () => {
    const rect = new RoughRect({
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      fill: 'black',
    });
    canvas.appendChild(rect);
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'rough-rect',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'rough-rect',
    );
  });

  it('should render a rough rect correctly.', async () => {
    const rect = new RoughRect({
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      fill: 'black',
      stroke: 'red',
      strokeWidth: 2,
    });
    canvas.appendChild(rect);
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'rough-rect-stroke',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'rough-rect-stroke',
    );
  });

  it('should render a rough rect correctly.', async () => {
    const rect = new RoughRect({
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      fill: 'black',
      stroke: 'red',
      strokeWidth: 2,
      dropShadowBlurRadius: 4,
      dropShadowColor: 'blue',
      dropShadowOffsetX: 5,
      dropShadowOffsetY: 5,
    });
    canvas.appendChild(rect);
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'rough-rect-dropshadow',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'rough-rect-dropshadow',
    );
  });

  it('should render a simple rough rect correctly.', async () => {
    const rect = new RoughRect({
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      fill: 'black',
    });
    canvas.appendChild(rect);
    canvas.render();

    rect.height = 20;
    rect.width = 20;
    rect.fillStyle = 'dots';
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'rough-rect-rerender',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'rough-rect-rerender',
    );
  });
});
