import _gl from 'gl';
import { JSDOM } from 'jsdom';
import xmlserializer from 'xmlserializer';
import { getCanvas } from '../utils';
import '../useSnapshotMatchers';
import { Canvas, RoughCircle, ImageExporter } from '../../packages/core/src';

const dir = `${__dirname}/snapshots`;
let $canvas: HTMLCanvasElement;
let canvas: Canvas;
let exporter: ImageExporter;

describe('RoughCircle', () => {
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

  it('should render a simple rough circle correctly.', async () => {
    const circle = new RoughCircle({
      cx: 100,
      cy: 100,
      r: 50,
      fill: 'black',
      stroke: 'red',
    });
    canvas.appendChild(circle);
    canvas.render();
    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'rough-circle',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'rough-circle',
    );
  });

  it('should render a rough circle with zigzag fillStyle correctly.', async () => {
    const circle = new RoughCircle({
      cx: 100,
      cy: 100,
      r: 50,
      fill: 'black',
      stroke: 'red',
      bowing: 2,
      roughness: 2,
      fillStyle: 'zigzag',
    });
    canvas.appendChild(circle);
    canvas.render();
    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'rough-circle-zigzag',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'rough-circle-zigzag',
    );
  });

  it('should render a rough circle with cross-hatch fillStyle correctly.', async () => {
    const circle = new RoughCircle({
      cx: 100,
      cy: 100,
      r: 50,
      fill: 'black',
      stroke: 'red',
      bowing: 2,
      roughness: 2,
      fillStyle: 'cross-hatch',
      fillWeight: 2,
    });
    canvas.appendChild(circle);
    canvas.render();
    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'rough-circle-cross-hatch',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'rough-circle-cross-hatch',
    );
  });

  it('should render a rough circle with solid fillStyle correctly.', async () => {
    const circle = new RoughCircle({
      cx: 100,
      cy: 100,
      r: 50,
      fill: 'black',
      stroke: 'red',
      fillStyle: 'solid',
    });
    canvas.appendChild(circle);
    canvas.render();
    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'rough-circle-solid',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'rough-circle-solid',
    );
  });

  it('should render a rough circle with dashed fillStyle correctly.', async () => {
    const circle = new RoughCircle({
      cx: 100,
      cy: 100,
      r: 50,
      fill: 'black',
      stroke: 'red',
      fillStyle: 'dashed',
    });
    canvas.appendChild(circle);
    canvas.render();
    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'rough-circle-dashed',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'rough-circle-dashed',
    );
  });
});
