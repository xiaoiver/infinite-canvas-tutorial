import {
  computeCovariance3D,
  quatToMat3,
} from '../../packages/plugin-gsplat/src/math/covariance';
import { sortByDepth } from '../../packages/plugin-gsplat/src/math/sort';
import { shDcToColor, sigmoid, SH_C0 } from '../../packages/plugin-gsplat/src/math/sh';

describe('gsplat math', () => {
  describe('quatToMat3', () => {
    it('returns identity for the identity quaternion', () => {
      const m = quatToMat3(0, 0, 0, 1);
      expect(m).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    });
  });

  describe('computeCovariance3D', () => {
    it('is diagonal (scale²) with no rotation', () => {
      const [xx, xy, xz, yy, yz, zz] = computeCovariance3D(
        [2, 3, 4],
        [0, 0, 0, 1],
      );
      expect(xx).toBeCloseTo(4, 5);
      expect(yy).toBeCloseTo(9, 5);
      expect(zz).toBeCloseTo(16, 5);
      expect(xy).toBeCloseTo(0, 5);
      expect(xz).toBeCloseTo(0, 5);
      expect(yz).toBeCloseTo(0, 5);
    });

    it('preserves trace (sum of scale²) under rotation', () => {
      // 90° rotation about Z.
      const q: [number, number, number, number] = [0, 0, Math.SQRT1_2, Math.SQRT1_2];
      const [xx, , , yy, , zz] = computeCovariance3D([1, 2, 3], q);
      // Trace is rotation-invariant: 1 + 4 + 9 = 14.
      expect(xx + yy + zz).toBeCloseTo(14, 5);
    });

    it('is symmetric positive (diagonal entries non-negative)', () => {
      const q: [number, number, number, number] = [0.1, 0.2, 0.3, 0.927];
      const [xx, , , yy, , zz] = computeCovariance3D([1.5, 0.5, 2], q);
      expect(xx).toBeGreaterThan(0);
      expect(yy).toBeGreaterThan(0);
      expect(zz).toBeGreaterThan(0);
    });
  });

  describe('sortByDepth', () => {
    // Identity view matrix (column-major): view-space z == world z.
    const identityView = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    it('orders gaussians farthest (most negative z) first', () => {
      // z values: -10 (far), 0, -5. Expect order far→near: idx0(-10), idx2(-5), idx1(0).
      const centers = new Float32Array([
        0, 0, -10,
        0, 0, 0,
        0, 0, -5,
      ]);
      const order = sortByDepth(centers, 3, identityView);
      expect(Array.from(order)).toEqual([0, 2, 1]);
    });

    it('returns identity order when all depths are equal', () => {
      const centers = new Float32Array([1, 1, -4, 2, 2, -4, 3, 3, -4]);
      const order = sortByDepth(centers, 3, identityView);
      expect(Array.from(order)).toEqual([0, 1, 2]);
    });

    it('handles an empty scene', () => {
      const order = sortByDepth(new Float32Array(0), 0, identityView);
      expect(order.length).toBe(0);
    });

    it('reuses the provided output buffer', () => {
      const centers = new Float32Array([0, 0, -1, 0, 0, -2]);
      const out = new Uint32Array(2);
      const order = sortByDepth(centers, 2, identityView, out);
      expect(order.buffer).toBe(out.buffer);
      expect(Array.from(order)).toEqual([1, 0]);
    });
  });

  describe('sh', () => {
    it('decodes mid-gray for a zero DC coefficient', () => {
      expect(shDcToColor(0)).toBeCloseTo(0.5, 6);
    });
    it('clamps to [0, 1]', () => {
      expect(shDcToColor(1000)).toBe(1);
      expect(shDcToColor(-1000)).toBe(0);
    });
    it('uses the correct SH_C0 constant', () => {
      expect(shDcToColor(1)).toBeCloseTo(0.5 + SH_C0, 6);
    });
    it('sigmoid(0) is 0.5', () => {
      expect(sigmoid(0)).toBeCloseTo(0.5, 6);
    });
  });
});
