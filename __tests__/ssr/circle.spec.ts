import _gl from 'gl';
import '../useSnapshotMatchers';
import {
  Canvas,
  Circle,
  ImageExporter,
  DOMAdapter,
} from '../../packages/core/src';
import { loadImage as loadImageCanvas } from 'canvas';
import { loadImage, NodeJSAdapter } from '../utils';

DOMAdapter.set(NodeJSAdapter);

const dir = `${__dirname}/snapshots`;
let $canvas: HTMLCanvasElement;
let canvas: Canvas;
let exporter: ImageExporter;

describe('Circle', () => {
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

  it('should render a simple circle correctly.', async () => {
    const circle = new Circle({
      cx: 100,
      cy: 100,
      r: 50,
      fill: 'black',
    });
    canvas.appendChild(circle);
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(dir, 'circle');
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(dir, 'circle');
  });

  it('should render a circle with stroke correctly.', async () => {
    const circle = new Circle({
      cx: 100,
      cy: 100,
      r: 50,
      fill: 'black',
      stroke: 'black',
      strokeOpacity: 0.5,
      strokeWidth: 20,
    });
    canvas.appendChild(circle);
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'circle-stroke',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'circle-stroke',
    );
  });

  it('should render a circle with stroke alignment correctly.', async () => {
    const circle1 = new Circle({
      cx: 50,
      cy: 50,
      r: 50,
      fill: 'red',
      stroke: 'black',
      strokeOpacity: 0.5,
      strokeWidth: 20,
      strokeAlignment: 'inner',
    });
    canvas.appendChild(circle1);

    const circle2 = new Circle({
      cx: 150,
      cy: 50,
      r: 50,
      fill: 'red',
      stroke: 'black',
      strokeOpacity: 0.5,
      strokeWidth: 20,
      strokeAlignment: 'outer',
    });
    canvas.appendChild(circle2);

    const circle3 = new Circle({
      cx: 50,
      cy: 150,
      r: 50,
      fill: 'red',
      stroke: 'black',
      strokeOpacity: 0.5,
      strokeWidth: 20,
      strokeAlignment: 'center',
    });
    canvas.appendChild(circle3);

    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'circle-stroke-alignment',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'circle-stroke-alignment',
    );
  });

  it('should render a circle with stroke dasharray correctly.', async () => {
    const circle1 = new Circle({
      cx: 50,
      cy: 50,
      r: 50,
      fill: 'red',
      stroke: 'black',
      strokeOpacity: 0.5,
      strokeWidth: 20,
      strokeDasharray: [5, 5],
    });
    canvas.appendChild(circle1);

    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'circle-stroke-dasharray',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'circle-stroke-dasharray',
    );
  });

  it('should render a circle with image correctly.', async () => {
    const src = await loadImage(__dirname + '/canvas.png');
    const circle = new Circle({
      cx: 100,
      cy: 100,
      r: 50,
      // @ts-expect-error
      fill: src,
      stroke: 'black',
      strokeOpacity: 0.5,
      strokeWidth: 20,
    });
    canvas.appendChild(circle);
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'circle-image',
    );
  });

  it('should render a circle with image correctly.', async () => {
    const src = await loadImageCanvas(__dirname + '/canvas.png');
    const circle = new Circle({
      cx: 100,
      cy: 100,
      r: 50,
      // @ts-expect-error
      fill: src,
      stroke: 'black',
      strokeOpacity: 0.5,
      strokeWidth: 20,
    });
    canvas.appendChild(circle);
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'circle-image',
    );
  });

  it('should render a circle with sizeAttenuation correctly.', async () => {
    const circle1 = new Circle({
      cx: 50,
      cy: 50,
      r: 50,
      fill: 'red',
      stroke: 'black',
      sizeAttenuation: true,
    });
    canvas.appendChild(circle1);

    canvas.camera.zoom = 2;
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'circle-size-attenuation',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'circle-size-attenuation',
    );
  });
});
