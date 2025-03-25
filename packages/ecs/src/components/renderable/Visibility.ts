/**
 * User indication of whether an entity is visible. Propagates down the entity hierarchy.
 * @see https://docs.rs/bevy/0.15.3/bevy/render/view/enum.Visibility.html
 */

import { field, Type } from '@lastolivegames/becsy';

export class Visibility {
  @field({ type: Type.staticString(['inherited', 'hidden', 'visible']) })
  declare value: 'inherited' | 'hidden' | 'visible';

  constructor(value: 'inherited' | 'hidden' | 'visible' = 'inherited') {
    this.value = value;
  }
}
