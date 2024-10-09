import { Canvas, Polyline } from '../../../../packages/core/src';

export async function render(canvas: Canvas) {
  const polyline1 = new Polyline({
    points: [
      [50, 100],
      [50, 200],
      [150, 200],
      [150, 100],
    ],
    stroke: 'black',
    strokeWidth: 20,
    strokeAlignment: 'outer',
    fill: 'none',
    cullable: false,
    batchable: false,
  });
  canvas.appendChild(polyline1);
  const polyline4 = new Polyline({
    points: [
      [50, 100],
      [50, 200],
      [150, 200],
      [150, 100],
    ],
    stroke: 'red',
    strokeWidth: 2,
    // strokeAlignment: 'outer',
    fill: 'none',
    cullable: false,
    batchable: false,
  });
  canvas.appendChild(polyline4);

  const polyline2 = new Polyline({
    points: [
      [170, 100],
      [170, 200],
      [270, 200],
      [270, 100],
    ],
    stroke: 'black',
    strokeWidth: 20,
    // strokeAlignment: 'center',
    fill: 'none',
    cullable: false,
    batchable: false,
  });
  canvas.appendChild(polyline2);
  const polyline5 = new Polyline({
    points: [
      [170, 100],
      [170, 200],
      [270, 200],
      [270, 100],
    ],
    stroke: 'red',
    strokeWidth: 2,
    fill: 'none',
    cullable: false,
    batchable: false,
  });
  canvas.appendChild(polyline5);

  const polyline3 = new Polyline({
    points: [
      [310, 100],
      [310, 200],
      [410, 200],
      [410, 100],
    ],
    stroke: 'black',
    strokeWidth: 20,
    strokeAlignment: 'inner',
    fill: 'none',
    cullable: false,
    batchable: false,
  });
  canvas.appendChild(polyline3);
  const polyline6 = new Polyline({
    points: [
      [310, 100],
      [310, 200],
      [410, 200],
      [410, 100],
    ],
    stroke: 'red',
    strokeWidth: 2,
    fill: 'none',
    cullable: false,
    batchable: false,
  });
  canvas.appendChild(polyline6);

  canvas.render();
}
