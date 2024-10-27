/**
 * Bezier Curves formulas obtained from
 * https://en.wikipedia.org/wiki/B%C3%A9zier_curve
 *
 * @see https://github.com/mrdoob/three.js/blob/dev/src/extras/core/Interpolations.js
 */

function CatmullRom(t: number, p0: number, p1: number, p2: number, p3: number) {
  const v0 = (p2 - p0) * 0.5;
  const v1 = (p3 - p1) * 0.5;
  const t2 = t * t;
  const t3 = t * t2;
  return (
    (2 * p1 - 2 * p2 + v0 + v1) * t3 +
    (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 +
    v0 * t +
    p1
  );
}

function QuadraticBezierP0(t: number, p: number) {
  const k = 1 - t;
  return k * k * p;
}

function QuadraticBezierP1(t: number, p: number) {
  return 2 * (1 - t) * t * p;
}

function QuadraticBezierP2(t: number, p: number) {
  return t * t * p;
}

function QuadraticBezier(t: any, p0: any, p1: any, p2: any) {
  return (
    QuadraticBezierP0(t, p0) +
    QuadraticBezierP1(t, p1) +
    QuadraticBezierP2(t, p2)
  );
}

//

function CubicBezierP0(t: number, p: number) {
  const k = 1 - t;
  return k * k * k * p;
}

function CubicBezierP1(t: number, p: number) {
  const k = 1 - t;
  return 3 * k * k * t * p;
}

function CubicBezierP2(t: number, p: number) {
  return 3 * (1 - t) * t * t * p;
}

function CubicBezierP3(t: number, p: number) {
  return t * t * t * p;
}

function CubicBezier(t: any, p0: any, p1: any, p2: any, p3: any) {
  return (
    CubicBezierP0(t, p0) +
    CubicBezierP1(t, p1) +
    CubicBezierP2(t, p2) +
    CubicBezierP3(t, p3)
  );
}

export { CatmullRom, QuadraticBezier, CubicBezier };
