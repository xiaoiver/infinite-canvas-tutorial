/**
 * Keyframe sampling shared by minimal evaluator and lottie-web ExpressionManager mocks.
 */
import type * as Lottie from './type';

export function sampleScalarAtFrame(
  kfs: Lottie.OffsetKeyframe[],
  frame: number,
): number {
  if (!kfs.length) {
    return 0;
  }
  if (frame <= kfs[0].t) {
    return kfs[0].s as number;
  }
  for (let i = 0; i < kfs.length - 1; i++) {
    const cur = kfs[i];
    const next = kfs[i + 1];
    if (frame >= cur.t && frame < next.t) {
      if (cur.h === 1) {
        return cur.s as number;
      }
      const t0 = cur.t;
      const t1 = next.t;
      const v0 = cur.s as number;
      const v1 = next.s as number;
      const u = (frame - t0) / (t1 - t0);
      return v0 + (v1 - v0) * u;
    }
  }
  const last = kfs[kfs.length - 1];
  return last.s as number;
}

export function sampleVectorAtFrame(
  kfs: Lottie.OffsetKeyframe[],
  frame: number,
): number[] {
  if (!kfs.length) {
    return [0, 0];
  }
  if (frame <= kfs[0].t) {
    return [...(kfs[0].s as number[])];
  }
  for (let i = 0; i < kfs.length - 1; i++) {
    const cur = kfs[i];
    const next = kfs[i + 1];
    if (frame >= cur.t && frame < next.t) {
      const v0 = cur.s as number[];
      const v1 = next.s as number[];
      if (cur.h === 1) {
        return [...v0];
      }
      const u = (frame - cur.t) / (next.t - cur.t);
      return v0.map((v, idx) => v + ((v1[idx] ?? 0) - v) * u);
    }
  }
  return [...(kfs[kfs.length - 1].s as number[])];
}

/**
 * Normalize ExpressionManager results (arrays, Float32Array, scalars) to a fixed-length number tuple.
 * Shared by expression bakes and layer mocks that read `p.x` vector expressions.
 */
export function coerceVectorEvalResult(
  evaluated: unknown,
  dim: number,
  fallback: number[],
): number[] {
  if (typeof evaluated === 'number' && Number.isFinite(evaluated) && dim === 1) {
    return [evaluated];
  }
  if (evaluated == null) {
    return fallback.slice(0, dim);
  }
  if (Array.isArray(evaluated) && evaluated.length >= dim) {
    const values: number[] = [];
    for (let d = 0; d < dim; d++) {
      const n = Number(evaluated[d]);
      values.push(Number.isFinite(n) ? n : fallback[d] ?? 0);
    }
    return values;
  }
  if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(evaluated)) {
    const v = evaluated as unknown as ArrayLike<number>;
    if (v.length >= dim) {
      const values: number[] = [];
      for (let d = 0; d < dim; d++) {
        const n = Number(v[d]);
        values.push(Number.isFinite(n) ? n : fallback[d] ?? 0);
      }
      return values;
    }
  }
  return fallback.slice(0, dim);
}
