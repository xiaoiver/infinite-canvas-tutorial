import _gl from 'gl';
import { NodeJSAdapter } from '../utils';
import '../useSnapshotMatchers';
import {
  Canvas,
  DOMAdapter,
  ImageExporter,
  Rect,
} from '../../packages/core/src';

const dir = `${__dirname}/snapshots`;
let $canvas: HTMLCanvasElement;
let canvas: Canvas;
let exporter: ImageExporter;

DOMAdapter.set(NodeJSAdapter);

describe('Rect', () => {
  beforeEach(async () => {
    $canvas = DOMAdapter.get().createCanvas(200, 200) as HTMLCanvasElement;
    canvas = await new Canvas({
      canvas: $canvas,
    }).initialized;
    exporter = new ImageExporter({
      canvas,
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

  it('should render a rect with inner shadow correctly.', async () => {
    const rect = new Rect({
      x: 50,
      y: 50,
      width: 50,
      height: 50,
      fill: 'white',
      innerShadowBlurRadius: 10,
      innerShadowColor: 'black',
      innerShadowOffsetX: 10,
      innerShadowOffsetY: 10,
    });
    canvas.appendChild(rect);

    const rect2 = new Rect({
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      fill: 'white',
      innerShadowBlurRadius: 10,
      innerShadowColor: 'black',
      innerShadowOffsetX: 10,
      innerShadowOffsetY: 10,
      batchable: false,
    });
    canvas.appendChild(rect2);

    const rect3 = new Rect({
      x: 100,
      y: 50,
      width: 20,
      height: 20,
      fill: 'white',
      innerShadowBlurRadius: 8,
      innerShadowColor: 'black',
    });
    canvas.appendChild(rect3);

    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'rect-innershadow',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'rect-innershadow',
    );
  });

  it('should render a rect with drop shadow correctly.', async () => {
    const rect = new Rect({
      x: 50,
      y: 50,
      width: 50,
      height: 50,
      fill: 'white',
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
      fill: 'white',
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
      fill: 'white',
      dropShadowBlurRadius: 8,
      dropShadowColor: 'black',
    });
    canvas.appendChild(rect3);

    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'rect-dropshadow',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'rect-dropshadow',
    );
  });

  it('should render a rect with stroke dasharray correctly.', async () => {
    const rect = new Rect({
      x: 50,
      y: 50,
      width: 100,
      height: 50,
      fill: 'red',
      stroke: 'black',
      strokeOpacity: 0.5,
      strokeWidth: 20,
      strokeDasharray: [5, 5],
    });
    canvas.appendChild(rect);

    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'rect-stroke-dasharray',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'rect-stroke-dasharray',
    );
  });

  it('should render a rounded rect correctly.', async () => {
    const rect = new Rect({
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      cornerRadius: 10,
      fill: 'black',
    });
    canvas.appendChild(rect);
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'rect-rounded',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'rect-rounded',
    );
  });

  it('should render a rect with negative size correctly.', async () => {
    const rect = new Rect({
      x: 100,
      y: 100,
      width: -100,
      height: -100,
      fill: 'black',
    });
    canvas.appendChild(rect);
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'rect-negative-size',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'rect-negative-size',
    );
  });

  it('should render a rect with negative size and drop shadow correctly.', async () => {
    const rect = new Rect({
      x: 100,
      y: 100,
      width: -50,
      height: -50,
      fill: 'white',
      dropShadowBlurRadius: 10,
      dropShadowColor: 'black',
      dropShadowOffsetX: 10,
      dropShadowOffsetY: 10,
    });
    canvas.appendChild(rect);
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'rect-negative-size-dropshadow',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'rect-negative-size-dropshadow',
    );
  });
});
