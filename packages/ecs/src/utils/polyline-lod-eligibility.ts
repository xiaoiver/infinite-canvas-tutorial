import type { Entity } from '@lastolivegames/becsy';
import {
  Children,
  ClipMode,
  DropShadow,
  Editable,
  FillLayers,
  FillTexture,
  Filter,
  Highlighted,
  InnerShadow,
  Marker,
  NodeLayerBlendMode,
  Polyline,
  Rough,
  Selected,
  SizeAttenuation,
  Stroke,
  StrokeLayers,
  UI,
  Wireframe,
} from '../components';

/** Keep unsupported joins, dash travel, marker tangents, fills and effects exact. */
export function supportsPolylineLOD(shape: Entity): boolean {
  if (
    !shape.has(Polyline) ||
    !shape.has(Stroke) ||
    shape.hasSomeOf(Rough, UI, FillTexture, Wireframe, SizeAttenuation)
  )
    return false;
  const stroke = shape.read(Stroke);
  if (
    stroke.alignment !== 'center' ||
    stroke.linejoin !== 'round' ||
    !Number.isFinite(stroke.width) ||
    stroke.width <= 0 ||
    stroke.dasharray[0] !== 0 ||
    stroke.dasharray[1] !== 0
  )
    return false;
  if (shape.has(Marker)) {
    const marker = shape.read(Marker);
    if (marker.start !== 'none' || marker.end !== 'none') return false;
  }
  if (
    shape.has(FillLayers) &&
    shape.read(FillLayers).layers.some((l) => l.enabled !== false)
  )
    return false;
  const strokes = shape.has(StrokeLayers)
    ? shape.read(StrokeLayers).layers.filter((l) => l.enabled !== false)
    : [];
  if (
    strokes.length !== 1 ||
    strokes[0].type !== 'solid' ||
    (strokes[0].blendMode && strokes[0].blendMode !== 'normal')
  )
    return false;
  let ancestor: Entity = shape;
  while (ancestor) {
    if (
      ancestor.hasSomeOf(
        Selected,
        Highlighted,
        ClipMode,
        Filter,
        NodeLayerBlendMode,
        DropShadow,
        InnerShadow,
      ) ||
      (ancestor.has(Editable) && ancestor.read(Editable).isEditing)
    )
      return false;
    ancestor = ancestor.has(Children) ? ancestor.read(Children).parent : null;
  }
  return true;
}
