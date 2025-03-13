import { Stroke } from '../components';
import { PointerEvents } from '../events';

export function strokeOffset(
  strokeAlignment: 'center' | 'inner' | 'outer',
  strokeWidth: number,
) {
  if (strokeAlignment === 'center') {
    return strokeWidth / 2;
  } else if (strokeAlignment === 'inner') {
    return 0;
  } else if (strokeAlignment === 'outer') {
    return strokeWidth;
  }
  return 0;
}

export function isFillOrStrokeAffected(
  pointerEvents: PointerEvents,
  fill: string | CanvasImageSource,
  stroke: string,
): [boolean, boolean] {
  let hasFill = false;
  let hasStroke = false;
  const isFillOtherThanNone = !!fill && fill !== 'none';
  const isStrokeOtherThanNone = !!stroke && stroke !== 'none';
  if (
    pointerEvents === 'visiblepainted' ||
    pointerEvents === 'painted' ||
    pointerEvents === 'auto'
  ) {
    hasFill = isFillOtherThanNone;
    hasStroke = isStrokeOtherThanNone;
  } else if (pointerEvents === 'visiblefill' || pointerEvents === 'fill') {
    hasFill = true;
  } else if (pointerEvents === 'visiblestroke' || pointerEvents === 'stroke') {
    hasStroke = true;
  } else if (pointerEvents === 'visible' || pointerEvents === 'all') {
    // The values of the fill and stroke do not affect event processing.
    hasFill = true;
    hasStroke = true;
  }

  return [hasFill, hasStroke];
}

export function hasValidStroke(stroke: Stroke) {
  return !!stroke.stroke && stroke.width > 0;
}
