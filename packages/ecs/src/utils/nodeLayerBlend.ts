import type { Entity } from '@lastolivegames/becsy';
import type { API } from '../API';
import type { FillLayerBlendMode } from '../types/fill-layer-blend';

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

export function isNonNormalNodeLayerBlend(
  mode: FillLayerBlendMode | undefined,
): boolean {
  return mode != null && mode !== 'normal';
}
