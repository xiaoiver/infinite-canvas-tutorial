import { Shape } from '../shapes';

export function traverse(
  shape: Shape,
  callback: (shape: Shape) => boolean | void,
) {
  if (!callback(shape)) {
    shape.children.forEach((child) => {
      traverse(child, callback);
    });
  }
}
