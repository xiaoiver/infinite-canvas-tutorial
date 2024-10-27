import { vec2 } from 'gl-matrix';
import { Path } from './path';
import { path2Absolute } from '@antv/util';

export class ShapePath {
  type = 'ShapePath';
  currentPath: Path | null;
  subPaths: Path[];

  constructor() {
    this.subPaths = [];
    this.currentPath = null;
  }

  moveTo(x: number, y: number) {
    this.currentPath = new Path();
    this.subPaths.push(this.currentPath);
    this.currentPath.moveTo(x, y);

    return this;
  }

  lineTo(x: number, y: number) {
    this.currentPath.lineTo(x, y);

    return this;
  }

  quadraticCurveTo(aCPx: number, aCPy: number, aX: number, aY: number) {
    this.currentPath.quadraticCurveTo(aCPx, aCPy, aX, aY);

    return this;
  }

  bezierCurveTo(
    aCP1x: number,
    aCP1y: number,
    aCP2x: number,
    aCP2y: number,
    aX: number,
    aY: number,
  ) {
    this.currentPath.bezierCurveTo(aCP1x, aCP1y, aCP2x, aCP2y, aX, aY);

    return this;
  }
}

export function parsePath(d: string) {
  const path = new ShapePath();

  const point = vec2.create();
  const control = vec2.create();

  const firstPoint = vec2.create();
  let isFirstPoint = true;
  let doSetFirstPoint = false;

  const commands = path2Absolute(d);

  commands.forEach((command) => {
    const type = command[0];
    const data = command.slice(1);

    if (isFirstPoint === true) {
      doSetFirstPoint = true;
      isFirstPoint = false;
    }

    let numbers: number[];

    switch (type) {
      case 'M':
        numbers = data as number[];
        for (let j = 0, jl = numbers.length; j < jl; j += 2) {
          point[0] = numbers[j + 0];
          point[1] = numbers[j + 1];
          control[0] = point[0];
          control[1] = point[1];

          if (j === 0) {
            path.moveTo(point[0], point[1]);
          } else {
            path.lineTo(point[0], point[1]);
          }

          if (j === 0) vec2.copy(firstPoint, point);
        }

        break;

      case 'H':
        numbers = data as number[];

        for (let j = 0, jl = numbers.length; j < jl; j++) {
          point[0] = numbers[j];
          control[0] = point[0];
          control[1] = point[1];
          path.lineTo(point[0], point[1]);

          if (j === 0 && doSetFirstPoint === true) vec2.copy(firstPoint, point);
        }

        break;

      case 'V':
        numbers = data as number[];

        for (let j = 0, jl = numbers.length; j < jl; j++) {
          point[1] = numbers[j];
          control[0] = point[0];
          control[1] = point[1];
          path.lineTo(point[0], point[1]);

          if (j === 0 && doSetFirstPoint === true) vec2.copy(firstPoint, point);
        }

        break;

      case 'L':
        numbers = data as number[];

        for (let j = 0, jl = numbers.length; j < jl; j += 2) {
          point[0] = numbers[j + 0];
          point[1] = numbers[j + 1];
          control[0] = point[0];
          control[1] = point[1];
          path.lineTo(point[0], point[1]);

          if (j === 0 && doSetFirstPoint === true) vec2.copy(firstPoint, point);
        }

        break;

      case 'C':
        numbers = data as number[];

        for (let j = 0, jl = numbers.length; j < jl; j += 6) {
          path.bezierCurveTo(
            numbers[j + 0],
            numbers[j + 1],
            numbers[j + 2],
            numbers[j + 3],
            numbers[j + 4],
            numbers[j + 5],
          );
          control[0] = numbers[j + 2];
          control[1] = numbers[j + 3];
          point[0] = numbers[j + 4];
          point[1] = numbers[j + 5];

          if (j === 0 && doSetFirstPoint === true) vec2.copy(firstPoint, point);
        }

        break;

      case 'S':
        numbers = data as number[];

        for (let j = 0, jl = numbers.length; j < jl; j += 4) {
          path.bezierCurveTo(
            getReflection(point[0], control[0]),
            getReflection(point[1], control[1]),
            numbers[j + 0],
            numbers[j + 1],
            numbers[j + 2],
            numbers[j + 3],
          );
          control[0] = numbers[j + 0];
          control[1] = numbers[j + 1];
          point[0] = numbers[j + 2];
          point[1] = numbers[j + 3];

          if (j === 0 && doSetFirstPoint === true) vec2.copy(firstPoint, point);
        }

        break;

      case 'Q':
        numbers = data as number[];

        for (let j = 0, jl = numbers.length; j < jl; j += 4) {
          path.quadraticCurveTo(
            numbers[j + 0],
            numbers[j + 1],
            numbers[j + 2],
            numbers[j + 3],
          );
          control[0] = numbers[j + 0];
          control[1] = numbers[j + 1];
          point[0] = numbers[j + 2];
          point[1] = numbers[j + 3];

          if (j === 0 && doSetFirstPoint === true) vec2.copy(firstPoint, point);
        }

        break;

      case 'T':
        numbers = data as number[];

        for (let j = 0, jl = numbers.length; j < jl; j += 2) {
          const rx = getReflection(point[0], control[0]);
          const ry = getReflection(point[1], control[1]);
          path.quadraticCurveTo(rx, ry, numbers[j + 0], numbers[j + 1]);
          control[0] = rx;
          control[1] = ry;
          point[0] = numbers[j + 0];
          point[1] = numbers[j + 1];

          if (j === 0 && doSetFirstPoint === true) vec2.copy(firstPoint, point);
        }

        break;

      case 'A':
        // numbers = parseFloats(data, [3, 4], 7);
        numbers = data as number[];

        for (let j = 0, jl = numbers.length; j < jl; j += 7) {
          // skip command if start point == end point
          if (numbers[j + 5] == point[0] && numbers[j + 6] == point[1])
            continue;

          const start = vec2.clone(point);
          // const start = point.clone();
          point[0] = numbers[j + 5];
          point[1] = numbers[j + 6];
          control[0] = point[0];
          control[1] = point[1];
          parseArcCommand(
            path,
            numbers[j],
            numbers[j + 1],
            numbers[j + 2],
            numbers[j + 3],
            numbers[j + 4],
            start,
            point,
          );

          if (j === 0 && doSetFirstPoint === true) vec2.copy(firstPoint, point);
        }

        break;

      case 'Z':
        path.currentPath.autoClose = true;

        if (path.currentPath.curves.length > 0) {
          // Reset point to beginning of Path
          vec2.copy(point, firstPoint);
          vec2.copy(path.currentPath.currentPoint, point);
          isFirstPoint = true;
        }

        break;

      default:
        console.warn(command);
    }

    // console.log( type, parseFloats( data ), parseFloats( data ).length  )

    doSetFirstPoint = false;
  });

  return path;
}

// http://www.w3.org/TR/SVG11/implnote.html#PathElementImplementationNotes

function getReflection(a: number, b: number) {
  return a - (b - a);
}

/**
 * https://www.w3.org/TR/SVG/implnote.html#ArcImplementationNotes
 * https://mortoray.com/2017/02/16/rendering-an-svg-elliptical-arc-as-bezier-curves/ Appendix: Endpoint to center arc conversion
 * From
 * rx ry x-axis-rotation large-arc-flag sweep-flag x y
 * To
 * aX, aY, xRadius, yRadius, aStartAngle, aEndAngle, aClockwise, aRotation
 */
function parseArcCommand(
  path: ShapePath,
  rx: number,
  ry: number,
  x_axis_rotation: number,
  large_arc_flag: number,
  sweep_flag: number,
  start: vec2,
  end: vec2,
) {
  if (rx == 0 || ry == 0) {
    // draw a line if either of the radii == 0
    path.lineTo(end[0], end[1]);
    return;
  }

  x_axis_rotation = (x_axis_rotation * Math.PI) / 180;

  // Ensure radii are positive
  rx = Math.abs(rx);
  ry = Math.abs(ry);

  // Compute (x1', y1')
  const dx2 = (start[0] - end[0]) / 2.0;
  const dy2 = (start[1] - end[1]) / 2.0;
  const x1p = Math.cos(x_axis_rotation) * dx2 + Math.sin(x_axis_rotation) * dy2;
  const y1p =
    -Math.sin(x_axis_rotation) * dx2 + Math.cos(x_axis_rotation) * dy2;

  // Compute (cx', cy')
  let rxs = rx * rx;
  let rys = ry * ry;
  const x1ps = x1p * x1p;
  const y1ps = y1p * y1p;

  // Ensure radii are large enough
  const cr = x1ps / rxs + y1ps / rys;

  if (cr > 1) {
    // scale up rx,ry equally so cr == 1
    const s = Math.sqrt(cr);
    rx = s * rx;
    ry = s * ry;
    rxs = rx * rx;
    rys = ry * ry;
  }

  const dq = rxs * y1ps + rys * x1ps;
  const pq = (rxs * rys - dq) / dq;
  let q = Math.sqrt(Math.max(0, pq));
  if (large_arc_flag === sweep_flag) q = -q;
  const cxp = (q * rx * y1p) / ry;
  const cyp = (-q * ry * x1p) / rx;

  // Step 3: Compute (cx, cy) from (cx', cy')
  const cx =
    Math.cos(x_axis_rotation) * cxp -
    Math.sin(x_axis_rotation) * cyp +
    (start[0] + end[0]) / 2;
  const cy =
    Math.sin(x_axis_rotation) * cxp +
    Math.cos(x_axis_rotation) * cyp +
    (start[1] + end[1]) / 2;

  // Step 4: Compute θ1 and Δθ
  const theta = svgAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  const delta =
    svgAngle(
      (x1p - cxp) / rx,
      (y1p - cyp) / ry,
      (-x1p - cxp) / rx,
      (-y1p - cyp) / ry,
    ) %
    (Math.PI * 2);

  path.currentPath.absellipse(
    cx,
    cy,
    rx,
    ry,
    theta,
    theta + delta,
    sweep_flag === 0,
    x_axis_rotation,
  );
}

function svgAngle(ux: number, uy: number, vx: number, vy: number) {
  const dot = ux * vx + uy * vy;
  const len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
  let ang = Math.acos(Math.max(-1, Math.min(1, dot / len))); // floating point precision, slightly over values appear
  if (ux * vy - uy * vx < 0) ang = -ang;
  return ang;
}
