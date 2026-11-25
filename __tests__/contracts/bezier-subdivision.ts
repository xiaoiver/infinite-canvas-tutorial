import { createHash } from 'node:crypto';
import {
  bezierControls,
  type BezierPoint,
} from '../fixtures/bezier-subdivision';
import golden from '../fixtures/bezier-subdivision.json';

type Paths = { curves: object[]; autoClose: boolean }[];
interface Curves {
  CurvePath: new () => Paths[number];
  CubicBezierCurve: new (
    a: BezierPoint,
    b: BezierPoint,
    c: BezierPoint,
    d: BezierPoint,
  ) => object;
  QuadraticBezierCurve: new (
    a: BezierPoint,
    b: BezierPoint,
    c: BezierPoint,
  ) => object;
}
export function bezierSubdivisionContract(
  api: Curves,
  flatten: (paths: Paths, scale: number, radius?: number) => number[][][],
) {
  it.each(golden.cases)(
    'preserves exact baseline Float64 samples at scale $scale and radius $radius',
    ({ scale, radius, count, sha256 }) => {
      const paths = bezierControls().map((controls) => {
        controls.forEach((point) => Object.freeze(point));
        const path = new api.CurvePath();
        path.curves.push(
          controls.length === 4
            ? new api.CubicBezierCurve(...controls)
            : new api.QuadraticBezierCurve(...controls),
        );
        Object.freeze(path.curves);
        Object.freeze(path);
        return path;
      });
      const authored = JSON.stringify(paths);
      const hash = createHash('sha256');
      let total = 0;
      for (const line of flatten(paths, scale, radius)) {
        const bytes = Buffer.alloc(4 + line.length * 16);
        bytes.writeUInt32LE(line.length);
        line.forEach((point, i) => {
          bytes.writeDoubleLE(point[0], 4 + i * 16);
          bytes.writeDoubleLE(point[1], 12 + i * 16);
        });
        hash.update(bytes);
        total += line.length;
      }
      expect(total).toBe(count);
      expect(hash.digest('hex')).toBe(sha256);
      expect(JSON.stringify(paths)).toBe(authored);
    },
  );
}
