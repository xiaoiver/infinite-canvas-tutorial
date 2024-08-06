import { Canvas, Circle } from '../../../../packages/core';

export async function render(canvas: Canvas, $canvas: HTMLCanvasElement) {
  const circle1 = new Circle({
    cx: 100,
    cy: 100,
    r: 50,
    fill: 'black',
  });
  canvas.appendChild(circle1);

  const circle2 = new Circle({
    cx: 200,
    cy: 100,
    r: 50,
    fill: 'black',
    opacity: 0.5,
  });
  canvas.appendChild(circle2);

  const circle3 = new Circle({
    cx: 300,
    cy: 100,
    r: 50,
    fill: 'black',
    stroke: 'red',
    strokeWidth: 20,
    strokeOpacity: 0.5,
  });
  canvas.appendChild(circle3);

  const circle4 = new Circle({
    cx: 100,
    cy: 200,
    r: 50,
    fill: 'transparent',
    stroke: 'red',
    strokeWidth: 20,
    strokeOpacity: 0.5,
  });
  canvas.appendChild(circle4);

  const circle5 = new Circle({
    cx: 200,
    cy: 200,
    r: 50,
    fill: 'black',
    stroke: 'red',
    strokeWidth: 20,
    strokeOpacity: 0.5,
    strokeAlignment: 'inner',
  });
  canvas.appendChild(circle5);

  const circle6 = new Circle({
    cx: 300,
    cy: 200,
    r: 50,
    fill: 'black',
    stroke: 'red',
    strokeWidth: 20,
    strokeOpacity: 0.5,
    strokeAlignment: 'outer',
  });
  canvas.appendChild(circle6);

  canvas.render();
}
