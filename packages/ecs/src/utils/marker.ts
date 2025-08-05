export function lineArrow(x: number, y: number, r: number, angle: number) {
  const leftArrowAngle = Math.PI / 6;
  const rightArrowAngle = -Math.PI / 6;
  const leftHalfArrowX = x + r * Math.cos(leftArrowAngle + angle);
  const leftHalfArrowY = y + r * Math.sin(leftArrowAngle + angle);
  const rightHalfArrowX = x + r * Math.cos(rightArrowAngle + angle);
  const rightHalfArrowY = y + r * Math.sin(rightArrowAngle + angle);

  return [
    [leftHalfArrowX, leftHalfArrowY],
    [x, y],
    [rightHalfArrowX, rightHalfArrowY],
  ];
}

// export function triangleArrow(x: number, y: number, r: number, angle: number) {
//   const diffY = r * Math.sin((1 / 3) * Math.PI + angle);
//   return [
//     [x - r, y + diffY],
//     [x, y - diffY],
//     [x + r, y + diffY],
//     [x - r, y + diffY],
//   ];
// }

// export function diamondArrow(x: number, y: number, r: number, angle: number) {
//   const hr = r * 0.618;
//   return [
//     ['M', x - hr, y],
//     ['L', x, y - r],
//     ['L', x + hr, y],
//     ['L', x, y + r],
//     ['Z'],
//   ];
// }
