import _gl from 'gl';
import { NodeJSAdapter, sleep } from '../utils';
import '../useSnapshotMatchers';
import {
  Canvas,
  DOMAdapter,
  ImageExporter,
  Rect,
  Group,
} from '../../packages/core/src';

const dir = `${__dirname}/snapshots`;
let $canvas: HTMLCanvasElement;
let canvas: Canvas;
let exporter: ImageExporter;

DOMAdapter.set(NodeJSAdapter);

describe('Visibility', () => {
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

  it('should account for visibility in group correctly.', async () => {
    const group = new Group();
    const rect1 = new Rect({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fill: 'red',
      visible: false,
    });
    group.appendChild(rect1);
    const rect2 = new Rect({
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      fill: 'green',
    });
    group.appendChild(rect2);
    canvas.appendChild(group);
    group.visible = false;
    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'visibility-group-hide',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'visibility-group-hide',
    );

    await sleep(300);

    group.visible = true;
    canvas.render();
    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'visibility-group-show',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'visibility-group-show',
    );
  });
});
