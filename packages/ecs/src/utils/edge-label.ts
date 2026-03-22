import type { SerializedNode, TextSerializedNode } from '../types/serialized-node';
import { computeBidi } from '../systems/ComputeTextMetrics';
import { inferXYWidthHeight } from './deserialize/entity';

export { pointAlongPolylineByT } from './polyline-arclength';

/**
 * Recompute text box and anchors when the label anchor (in parent local space) moves.
 * Matches {@link inferXYWidthHeight} behaviour for `text` nodes.
 */
export function layoutTextAnchoredInParent(
  textNode: TextSerializedNode,
  anchorParentX: number,
  anchorParentY: number,
): Pick<TextSerializedNode, 'x' | 'y' | 'width' | 'height' | 'anchorX' | 'anchorY'> {
  const copy = {
    ...textNode,
    anchorX: anchorParentX,
    anchorY: anchorParentY,
  };
  delete (copy as Partial<TextSerializedNode>).x;
  delete (copy as Partial<TextSerializedNode>).y;
  delete (copy as Partial<TextSerializedNode>).width;
  delete (copy as Partial<TextSerializedNode>).height;
  computeBidi(copy.content);
  inferXYWidthHeight(copy as SerializedNode);
  return {
    x: copy.x!,
    y: copy.y!,
    width: copy.width!,
    height: copy.height!,
    anchorX: copy.anchorX!,
    anchorY: copy.anchorY!,
  };
}
