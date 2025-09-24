import { Entity, field } from '@lastolivegames/becsy';
import { SnapPoint } from './SnapPoint';

export class Snap {
  @field.backrefs(SnapPoint, 'camera') declare points: Entity[];
}
