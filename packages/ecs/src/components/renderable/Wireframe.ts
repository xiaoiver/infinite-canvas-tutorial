import { field, Type } from '@lastolivegames/becsy';

/**
 * Can be used for debugging complex Geometry.
 * @see https://infinitecanvas.cc/guide/lesson-005#wireframe
 */
export class Wireframe {
  @field({ type: Type.boolean, default: false })
  declare enabled: boolean;
}
