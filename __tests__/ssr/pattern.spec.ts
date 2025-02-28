import _gl from 'gl';
import { loadImage, NodeJSAdapter } from '../utils';
import { loadImage as loadImageCanvas } from 'canvas';
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

describe('Pattern', () => {
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

  it.skip('should render pattern correctly.', async () => {
    const image = await loadImage(__dirname + '/pattern.png');

    const rect = new Rect({
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      fill: {
        // @ts-ignore
        image,
        repeat: 'repeat',
      },
    });
    canvas.appendChild(rect);
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(dir, 'pattern');
  });

  it('should render pattern correctly.', async () => {
    const image = await loadImageCanvas(__dirname + '/pattern.png');

    const rect = new Rect({
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      fill: {
        // @ts-ignore
        image,
        repeat: 'repeat',
      },
    });
    canvas.appendChild(rect);
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(dir, 'pattern');
  });
});
