import { Shape } from '../shapes';

export function traverse(shape: Shape, callback: (shape: Shape) => void) {
  callback(shape);
  shape.children.forEach((child) => {
    traverse(child, callback);
  });
}
