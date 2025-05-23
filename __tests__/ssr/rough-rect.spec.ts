import _gl from 'gl';
import { NodeJSAdapter } from '../utils';
import '../useSnapshotMatchers';
import {
  Canvas,
  DOMAdapter,
  ImageExporter,
  RoughRect,
} from '../../packages/core/src';

const dir = `${__dirname}/snapshots`;
let $canvas: HTMLCanvasElement;
let canvas: Canvas;
let exporter: ImageExporter;

DOMAdapter.set(NodeJSAdapter);

describe('RoughRect', () => {
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
      {
        maxError: 1000,
      },
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
      {
        maxError: 1000,
      },
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
      {
        maxError: 1000,
      },
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'rough-rect-dropshadow',
    );
  });

  it.skip('should render a simple rough rect correctly.', async () => {
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
      {
        maxError: 1000,
      },
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'rough-rect-rerender',
    );
  });
});
