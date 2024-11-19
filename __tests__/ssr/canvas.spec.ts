import _gl from 'gl';
import {
  getCanvas,
  sleep,
  requestAnimationFrame,
  cancelAnimationFrame,
} from '../utils';
import '../useSnapshotMatchers';
import { Canvas, Circle } from '../../packages/core/src';
import { CheckboardStyle } from '../../packages/core/src/plugins';

let $canvas: HTMLCanvasElement;
let canvas: Canvas;

describe('Canvas API', () => {
  beforeEach(async () => {
    $canvas = getCanvas(200, 200);
    canvas = await new Canvas({
      canvas: $canvas,
    }).initialized;
  });
  afterEach(() => {
    canvas.destroy();
  });

  it('should use default value correctly.', () => {
    expect(canvas.getDOM()).toBe($canvas);
    expect(canvas.getDPR()).toBe(1);
    expect(canvas.checkboardStyle).toBe(CheckboardStyle.GRID);
  });

  it('should convert client & viewport coordinates correctly.', () => {
    $canvas.getBoundingClientRect = () => ({
      x: 50,
      y: 50,
      top: 50,
      left: 50,
      width: 100,
      height: 100,
      bottom: 150,
      right: 150,
      toJSON: () => {},
    });

    expect(canvas.client2Viewport({ x: 50, y: 50 })).toEqual({ x: 0, y: 0 });
    expect(canvas.viewport2Client({ x: 0, y: 0 })).toEqual({ x: 50, y: 50 });
  });

  it('should zoomIn / Out correctly.', async () => {
    // @ts-expect-error
    canvas.zoomIn(requestAnimationFrame, cancelAnimationFrame);
    // @ts-expect-error
    canvas.zoomOut(requestAnimationFrame, cancelAnimationFrame);

    await sleep(1000);
  });

  it('should appendChild & removeChild correctly.', () => {
    const circle = new Circle({
      cx: 100,
      cy: 100,
      r: 50,
      fill: 'black',
    });
    canvas.appendChild(circle);
    canvas.render();
    expect(canvas.elementFromPoint(100, 100)).toEqual(circle);
    expect(canvas.elementsFromPoint(100, 100)).toEqual([circle, canvas.root]);
    expect(canvas.elementsFromBBox(100, 100, 100, 100)).toEqual([circle]);

    canvas.removeChild(circle);
    canvas.render();
    expect(canvas.elementFromPoint(100, 100)).toBe(canvas.root);
    expect(canvas.elementsFromPoint(100, 100)).toEqual([canvas.root]);
    expect(canvas.elementsFromBBox(100, 100, 100, 100)).toEqual([]);
  });

  it('should pick shapes with bbox correctly.', () => {
    const circle = new Circle({
      cx: 100,
      cy: 100,
      r: 50,
      fill: 'black',
    });
    canvas.appendChild(circle);
    canvas.render();
    expect(canvas.elementsFromBBox(100, 100, 100, 100)).toEqual([circle]);

    circle.visible = false;
    canvas.render();
    expect(canvas.elementsFromBBox(100, 100, 100, 100)).toEqual([]);

    circle.visible = true;
    circle.pointerEvents = 'none';
    expect(canvas.elementsFromBBox(100, 100, 100, 100)).toEqual([]);
  });
});
