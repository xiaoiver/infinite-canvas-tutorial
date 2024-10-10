import { Canvas, Polyline } from '../../../../packages/core/src';

export async function render(canvas: Canvas) {
  const polyline1 = new Polyline({
    points: [
      [50, 50],
      [150, 150],
      [150, 50],
    ],
    stroke: 'red',
    strokeWidth: 20,
    strokeLinejoin: 'round',
  });
  canvas.appendChild(polyline1);

  const polyline2 = new Polyline({
    points: [
      [150, 50],
      [250, 150],
      [250, 50],
    ],
    stroke: 'red',
    strokeWidth: 20,
    strokeLinejoin: 'bevel',
  });
  canvas.appendChild(polyline2);

  const polyline3 = new Polyline({
    points: [
      [250, 50],
      [350, 150],
      [350, 50],
    ],
    stroke: 'red',
    strokeWidth: 20,
    strokeLinejoin: 'miter',
  });
  canvas.appendChild(polyline3);

  const polyline4 = new Polyline({
    points: [
      [50, 200],
      [150, 300],
      [150, 200],
    ],
    stroke: 'red',
    strokeWidth: 20,
    strokeLinejoin: 'round',
    strokeLinecap: 'round',
  });
  canvas.appendChild(polyline4);

  const polyline5 = new Polyline({
    points: [
      [200, 200],
      [300, 300],
      [300, 200],
    ],
    stroke: 'red',
    strokeWidth: 20,
    strokeLinejoin: 'round',
    strokeLinecap: 'square',
  });
  canvas.appendChild(polyline5);

  canvas.render();
}
