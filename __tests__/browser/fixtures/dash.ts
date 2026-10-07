import { Canvas, Polyline, Rect } from '../../../packages/lesson_012/src';
import { SmoothPolyline } from '../../../packages/lesson_012/src/drawcalls/SmoothPolyline';

export interface DashCase {
  points: [number, number][];
  dash: [number, number];
  offset?: number;
  width?: number;
  cap?: CanvasLineCap;
  join?: CanvasLineJoin;
  zoom?: number;
  closed?: boolean;
  alignment?: 'center' | 'inner' | 'outer';
  rect?: boolean;
}

declare global {
  interface Window {
    dashTest: {
      render(options: DashCase): void;
      offset(value: number): void;
      geometryBuilds(): number;
    };
  }
}

async function main() {
  const actual = document.querySelector<HTMLCanvasElement>('#actual')!;
  const reference = document.querySelector<HTMLCanvasElement>('#reference')!;
  const canvas = await new Canvas({
    canvas: actual,
    devicePixelRatio: 1,
    backgroundColor: 'white',
    gridColor: 'white',
  }).initialized;
  let geometryBuilds = 0;
  const createGeometry = SmoothPolyline.prototype.createGeometry;
  SmoothPolyline.prototype.createGeometry = function () {
    geometryBuilds++;
    return createGeometry.call(this);
  };
  let shape: Polyline | Rect | undefined;
  let redrawReference: (offset: number) => void;
  window.dashTest = {
    geometryBuilds: () => geometryBuilds,
    offset(value) {
      shape!.strokeDashoffset = value;
      canvas.render();
      redrawReference(value);
    },
    render({
      points,
      dash,
      offset = 0,
      width = 20,
      cap = 'butt',
      join = 'miter',
      zoom = 1,
      closed = false,
      alignment = 'center',
      rect = false,
    }) {
      if (shape) canvas.removeChild(shape);
      const style = {
        strokeAlignment: alignment,
        stroke: 'black',
        fill: 'none',
        strokeWidth: width,
        strokeDasharray: dash,
        strokeDashoffset: offset,
        strokeLinecap: cap,
        strokeLinejoin: join,
      };
      shape = rect
        ? new Rect({
            ...style,
            x: points[0][0],
            y: points[0][1],
            width: points[2][0] - points[0][0],
            height: points[2][1] - points[0][1],
          })
        : new Polyline({
            ...style,
            points: closed ? [...points, points[0]] : points,
          });
      canvas.camera.zoom = zoom;
      canvas.appendChild(shape);
      canvas.render();
      redrawReference = (nextOffset) => {
        const ctx = reference.getContext('2d')!;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 640, 320);
        ctx.scale(zoom, zoom);
        ctx.strokeStyle = 'black';
        ctx.lineWidth = width;
        ctx.lineJoin = join;
        ctx.lineCap = cap;
        ctx.setLineDash(dash);
        ctx.lineDashOffset = nextOffset;
        // Canvas2D has no strokeAlignment property; offset the centerline for
        // the straight-line alignment cases using the same right-hand normal.
        if (alignment !== 'center' && points.length === 2) {
          const dx = points[1][0] - points[0][0];
          const dy = points[1][1] - points[0][1];
          const shift =
            (width * (alignment === 'outer' ? 0.5 : -0.5)) / Math.hypot(dx, dy);
          ctx.translate(dy * shift, -dx * shift);
        }
        ctx.beginPath();
        let start = true;
        points.forEach(([x, y]) => {
          if (!Number.isFinite(x) || !Number.isFinite(y)) {
            start = true;
            return;
          }
          if (start) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          start = false;
        });
        if (closed) ctx.closePath();
        ctx.stroke();
      };
      redrawReference(offset);
    },
  };
  window.dashTest.render({
    points: [
      [100, 50],
      [100, 150],
      [230, 150],
    ],
    dash: [20, 30],
    cap: 'round',
    join: 'round',
  });
  document.querySelector('#status')!.textContent = 'Ready';
}
void main().catch((error) => {
  document.querySelector('#status')!.textContent = String(error);
  throw error;
});
