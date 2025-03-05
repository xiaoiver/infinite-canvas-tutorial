import { Canvas, Polyline } from '../../../../packages/core/src';

export async function render(canvas: Canvas) {
  const polyline1 = new Polyline({
    points: [
      [50, 50],
      [50, 150],
      [100, 150],
      [100, 50],
    ],
    stroke: 'black',
    strokeWidth: 20,
    strokeDasharray: [10, 10],
    fill: 'none',
  });
  canvas.appendChild(polyline1);

  const polyline2 = new Polyline({
    points: [
      [150, 50],
      [150, 150],
      [200, 150],
      [200, 50],
    ],
    stroke: 'black',
    strokeWidth: 20,
    strokeDasharray: [10, 10],
    strokeDashoffset: 10,
    fill: 'none',
  });
  canvas.appendChild(polyline2);

  const polyline3 = new Polyline({
    points: [
      [250, 50],
      [250, 150],
      [300, 150],
      [300, 50],
    ],
    stroke: 'black',
    strokeWidth: 20,
    strokeDasharray: [5, 10],
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
  });
  canvas.appendChild(polyline3);

  canvas.render();
}
