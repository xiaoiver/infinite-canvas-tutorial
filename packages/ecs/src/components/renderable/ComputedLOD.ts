import { Entity, field, Type } from '@lastolivegames/becsy';

/** Screen rendering only: never serialized, recorded in history, or synchronized. */
export class ComputedLOD {
  @field({ type: Type.staticString(['full', 'text-proxy']), default: 'full' })
  declare level: 'full' | 'text-proxy';

  @field.ref declare camera: Entity;
}
