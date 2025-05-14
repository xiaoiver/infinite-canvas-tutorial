import { field, Type } from '@lastolivegames/becsy';
import { Circle, Rect } from '../geometry';

export class Renderable {
  @field({ type: Type.boolean, default: false }) declare batchable: boolean;

  /**
   * Custom hit area for the renderable. e.g. for transformer anchors which need a larger hit area.
   * @see https://pixijs.com/8.x/examples/events/custom-hitarea
   */
  @field({ type: Type.object, default: null }) declare hitArea: Circle | Rect;

  constructor(props?: Partial<Renderable>) {
    this.batchable = props?.batchable ?? false;
    this.hitArea = props?.hitArea ?? null;
  }
}
