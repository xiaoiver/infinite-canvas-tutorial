import { Entity, field } from '@lastolivegames/becsy';
import Rbush from 'rbush';

export interface RBushNodeAABB {
  entity: Entity;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export class RBush {
  @field.object declare value: Rbush<RBushNodeAABB>;
}
