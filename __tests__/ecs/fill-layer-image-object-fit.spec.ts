import {
  computeObjectFitDrawRect,
  parseObjectPosition,
} from '../../packages/ecs/src/utils/fill-layer-image-object-fit';
import { resolveFillImageTexturePixelSize } from '../../packages/ecs/src/utils/fillImageTextureSize';

describe('parseObjectPosition', () => {
  it('defaults missing to center', () => {
    expect(parseObjectPosition('')).toEqual({ x: 0.5, y: 0.5 });
  });

  it('uses center for single value', () => {
    expect(parseObjectPosition('left')).toEqual({ x: 0, y: 0.5 });
    expect(parseObjectPosition('top')).toEqual({ x: 0.5, y: 0 });
  });

  it('parses two-axis keywords and percent', () => {
    expect(parseObjectPosition('right bottom')).toEqual({ x: 1, y: 1 });
    expect(parseObjectPosition('25% 75%')).toEqual({ x: 0.25, y: 0.75 });
    expect(parseObjectPosition('top left')).toEqual({ x: 0, y: 0 });
    expect(parseObjectPosition('left top')).toEqual({ x: 0, y: 0 });
  });
});

describe('computeObjectFitDrawRect', () => {
  const destW = 200;
  const destH = 100;
  const srcW = 400;
  const srcH = 200;

  it('fill stretches to destination', () => {
    expect(
      computeObjectFitDrawRect(srcW, srcH, destW, destH, 'fill'),
    ).toEqual({ dx: 0, dy: 0, dw: destW, dh: destH });
  });

  it('contain letterboxes with centered position', () => {
    const r = computeObjectFitDrawRect(srcW, srcH, destW, destH, 'contain');
    expect(r.dw).toBe(200);
    expect(r.dh).toBe(100);
    expect(r.dx).toBe(0);
    expect(r.dy).toBe(0);
  });

  it('contain on tall box centers horizontally', () => {
    const r = computeObjectFitDrawRect(400, 200, 100, 200, 'contain');
    expect(r.dw).toBe(100);
    expect(r.dh).toBe(50);
    expect(r.dx).toBe(0);
    expect(r.dy).toBe(75);
  });

  it('cover scales beyond destination and centers', () => {
    const r = computeObjectFitDrawRect(srcW, srcH, destW, destH, 'cover');
    expect(r.dw).toBe(200);
    expect(r.dh).toBe(100);
    expect(r.dx).toBe(0);
    expect(r.dy).toBe(0);
  });

  it('cover on wide box crops vertically', () => {
    const r = computeObjectFitDrawRect(400, 200, 200, 100, 'cover');
    expect(r.dw).toBe(200);
    expect(r.dh).toBe(100);
    expect(r.dx).toBe(0);
    expect(r.dy).toBe(0);
  });

  it('none uses intrinsic size', () => {
    const r = computeObjectFitDrawRect(80, 40, destW, destH, 'none');
    expect(r).toEqual({ dx: 60, dy: 30, dw: 80, dh: 40 });
  });

  it('scale-down uses none when image fits', () => {
    const r = computeObjectFitDrawRect(80, 40, destW, destH, 'scale-down');
    expect(r.dw).toBe(80);
    expect(r.dh).toBe(40);
  });

  it('scale-down uses contain when image overflows', () => {
    const r = computeObjectFitDrawRect(srcW, srcH, destW, destH, 'scale-down');
    expect(r.dw).toBe(200);
    expect(r.dh).toBe(100);
  });

  it('objectPosition top left', () => {
    const r = computeObjectFitDrawRect(80, 40, destW, destH, 'none', 'top left');
    expect(r).toEqual({ dx: 0, dy: 0, dw: 80, dh: 40 });
  });
});

describe('resolveFillImageTexturePixelSize', () => {
  it('uses geom×dpr for contain/cover, not intrinsic source size', () => {
    expect(
      resolveFillImageTexturePixelSize(1920, 1280, 400, 400, 2, 4096, 'contain'),
    ).toEqual({ width: 800, height: 800 });
    expect(
      resolveFillImageTexturePixelSize(1920, 1280, 400, 400, 2, 4096, 'cover'),
    ).toEqual({ width: 800, height: 800 });
  });

  it('fill still upscales to at least source pixels', () => {
    expect(
      resolveFillImageTexturePixelSize(1920, 1280, 400, 400, 2, 4096, 'fill'),
    ).toEqual({ width: 1920, height: 1280 });
  });
});
