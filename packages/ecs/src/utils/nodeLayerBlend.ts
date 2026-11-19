import type { Entity } from '@lastolivegames/becsy';
import type { API } from '../API';
import type { FillLayerBlendMode } from '../types/fill-layer-blend';
import { NodeLayerBlendMode } from '../components/renderable/NodeLayerBlendMode';

/** 读取节点级 mix-blend-mode（存于 API 场景图，见 {@link SerializedNode.blendMode}）。 */
export function getNodeLayerBlendMode(
  api: API,
  entity: Entity,
): FillLayerBlendMode | undefined {
  const node = api.getNodeByEntity(entity) as
    | { blendMode?: FillLayerBlendMode }
    | undefined;
  return node?.blendMode;
}

/** Render-time mirror maintained by deserialization and history/property updates.
 * Avoid a document/entity scan for every drawcall, including non-document UI.
 */
export function getRenderNodeLayerBlendMode(
  entity: Entity,
): FillLayerBlendMode | undefined {
  return entity.has(NodeLayerBlendMode)
    ? entity.read(NodeLayerBlendMode).mode
    : undefined;
}

export function isNonNormalNodeLayerBlend(
  mode: FillLayerBlendMode | undefined,
): boolean {
  return mode != null && mode !== 'normal';
}
