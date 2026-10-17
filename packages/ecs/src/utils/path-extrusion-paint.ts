import type { FillLayerItem } from './fillLayers';
import { getEnabledFillLayersFromItems } from './fillLayers';
import { getEnabledStrokeLayersFromItems } from './strokeLayers';

/** SVG import represents absent paint as a solid layer whose value is `none`. */
export function pathExtrusionPaintSupported(
  fills: FillLayerItem[] | undefined,
  strokes: FillLayerItem[] | undefined,
): boolean {
  const enabledFills = getEnabledFillLayersFromItems(fills);
  if (
    enabledFills.length !== 1 ||
    enabledFills[0].type !== 'solid' ||
    !enabledFills[0].value?.trim() ||
    enabledFills[0].value.trim().toLowerCase() === 'none' ||
    enabledFills[0].value.trim().toLowerCase().startsWith('url(')
  )
    return false;
  return getEnabledStrokeLayersFromItems(strokes).every(
    (stroke) =>
      stroke.type === 'solid' && stroke.value?.trim().toLowerCase() === 'none',
  );
}
