import { field, Type } from '@lastolivegames/becsy';
import type { FillLayerBlendMode } from '../../types/fill-layer-blend';

/** 节点级 mix-blend-mode；与 wire {@link SerializedNode.blendMode} 同步，用于触发重绘。 */
export class NodeLayerBlendMode {
  @field({ type: Type.object, default: 'normal' }) declare mode: FillLayerBlendMode;

  constructor(props?: Partial<NodeLayerBlendMode>) {
    Object.assign(this, props);
  }
}
