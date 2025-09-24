import { field, Type } from '@lastolivegames/becsy';

/**
 * Component that indicates whether an entity should maintain its aspect ratio during scaling operations.
 * When this component is present, the entity will scale proportionally to maintain its original width/height ratio.
 */
export class LockAspectRatio {
  /**
   * Whether the aspect ratio is locked. Default is true when the component is present.
   */
  @field({ type: Type.boolean, default: true }) declare enabled: boolean;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }
}
