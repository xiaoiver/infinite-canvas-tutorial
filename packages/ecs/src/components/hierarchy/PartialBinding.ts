import { Entity, field } from '@lastolivegames/becsy';
import { Binding } from './Binding';

/**
 * 仅一端连接图元、另一端由 `sourcePoint` / `targetPoint` 固定的边。
 * `attached` 为已连接侧的实体；`sourceIsAttached === true` 表示连接在 source（`fromId`）侧。
 */
export class PartialBinding {
  @field.ref declare attached: Entity;
  /** 1 = source（from）侧连接节点，0 = target（to）侧 */
  @field.int32 declare sourceIsAttached: number;

  constructor(props?: Partial<PartialBinding>) {
    Object.assign(this, props);
  }
}

export function hasFullOrPartialEdgeBinding(entity: Entity): boolean {
  return entity.has(Binding) || entity.has(PartialBinding);
}
