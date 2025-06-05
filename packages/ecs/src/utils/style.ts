import {
  AABB,
  Ellipse,
  Path,
  Polyline,
  Rect,
  Text,
  Stroke,
} from '../components';
import { SerializedNode } from './serialize/type';

export function strokeOffset(stroke?: Stroke) {
  if (!stroke) {
    return 0;
  }
  const { alignment = 'center', width = 0 } = stroke;
  if (alignment === 'center') {
    return width / 2;
  } else if (alignment === 'inner') {
    return 0;
  } else if (alignment === 'outer') {
    return width;
  }
  return 0;
}

// export function isFillOrStrokeAffected(
//   pointerEvents: PointerEvents,
//   fill: string | CanvasImageSource,
//   stroke: string,
// ): [boolean, boolean] {
//   let hasFill = false;
//   let hasStroke = false;
//   const isFillOtherThanNone = !!fill && fill !== 'none';
//   const isStrokeOtherThanNone = !!stroke && stroke !== 'none';
//   if (
//     pointerEvents === 'visiblepainted' ||
//     pointerEvents === 'painted' ||
//     pointerEvents === 'auto'
//   ) {
//     hasFill = isFillOtherThanNone;
//     hasStroke = isStrokeOtherThanNone;
//   } else if (pointerEvents === 'visiblefill' || pointerEvents === 'fill') {
//     hasFill = true;
//   } else if (pointerEvents === 'visiblestroke' || pointerEvents === 'stroke') {
//     hasStroke = true;
//   } else if (pointerEvents === 'visible' || pointerEvents === 'all') {
//     // The values of the fill and stroke do not affect event processing.
//     hasFill = true;
//     hasStroke = true;
//   }

//   return [hasFill, hasStroke];
// }

export function hasValidStroke(stroke: Stroke) {
  return !!stroke.color && stroke.width > 0;
}

export function getGeometryBounds(node: SerializedNode) {
  const { type } = node;
  if (type === 'rect') {
    return Rect.getGeometryBounds(node);
  } else if (type === 'ellipse') {
    return Ellipse.getGeometryBounds(node);
  } else if (type === 'polyline') {
    return Polyline.getGeometryBounds(node);
  } else if (type === 'path') {
    return Path.getGeometryBounds(node);
  } else if (type === 'text') {
    return Text.getGeometryBounds(node);
  } else if (type === 'g') {
    return new AABB(0, 0, 0, 0);
  }

  return new AABB(Infinity, Infinity, -Infinity, -Infinity);
}
