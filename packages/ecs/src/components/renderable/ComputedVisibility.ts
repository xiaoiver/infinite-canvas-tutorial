import { field, Type } from '@lastolivegames/becsy';

/**
 * Computed visibility of an entity.
 *
 * See {@link Visibility}
 */
export class ComputedVisibility {
  @field({ type: Type.boolean, default: false }) declare visible: boolean;
}
