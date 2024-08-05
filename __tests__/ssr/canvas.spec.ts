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

describe('Canvas API', () => {
  it('should use default value correctly.', async () => {
    const $canvas = getCanvas(200, 200);

    const canvas = await new Canvas({
      canvas: $canvas,
    }).initialized;

    expect(canvas.getDOM()).toBe($canvas);
    expect(canvas.getDPR()).toBe(1);
    expect(canvas.checkboardStyle).toBe(CheckboardStyle.GRID);

    canvas.destroy();
  });

  it('should convert client & viewport coordinates correctly.', async () => {
    const $canvas = getCanvas(200, 200);

    const canvas = await new Canvas({
      canvas: $canvas,
      getBoundingClientRect: () => ({
        x: 50,
        y: 50,
        top: 50,
        left: 50,
        width: 100,
        height: 100,
        bottom: 150,
        right: 150,
        toJSON: () => {},
      }),
    }).initialized;

    expect(canvas.client2Viewport({ x: 50, y: 50 })).toEqual({ x: 0, y: 0 });
    expect(canvas.viewport2Client({ x: 0, y: 0 })).toEqual({ x: 50, y: 50 });
  });

  it('should zoomIn / Out correctly.', async () => {
    const $canvas = getCanvas(200, 200);

    const canvas = await new Canvas({
      canvas: $canvas,
    }).initialized;

    // @ts-expect-error
    canvas.zoomIn(requestAnimationFrame, cancelAnimationFrame);
    // @ts-expect-error
    canvas.zoomOut(requestAnimationFrame, cancelAnimationFrame);

    sleep(1000);

    canvas.destroy();
  });

  it('should appendChild & removeChild correctly.', async () => {
    const $canvas = getCanvas(200, 200);

    const canvas = await new Canvas({
      canvas: $canvas,
    }).initialized;

    const circle = new Circle({
      cx: 100,
      cy: 100,
      r: 50,
      fill: 'black',
    });
    canvas.appendChild(circle);
    canvas.render();
    expect(canvas.elementFromPoint(100, 100)).toBe(circle);
    expect(canvas.elementsFromPoint(100, 100)).toEqual([circle, canvas.root]);
    expect(canvas.elementsFromBBox(100, 100, 100, 100)).toEqual([circle]);

    canvas.removeChild(circle);
    canvas.render();
    expect(canvas.elementFromPoint(100, 100)).toBe(canvas.root);
    expect(canvas.elementsFromPoint(100, 100)).toEqual([canvas.root]);
    expect(canvas.elementsFromBBox(100, 100, 100, 100)).toEqual([]);

    canvas.destroy();
  });

  it('should pick shapes with bbox correctly.', async () => {
    const $canvas = getCanvas(200, 200);

    const canvas = await new Canvas({
      canvas: $canvas,
    }).initialized;

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
