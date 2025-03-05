import { isUndefined } from '@antv/util';
import { GConstructor } from '.';

export interface ISortable {
  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/z-index
   */
  zIndex: number;
}

export type SortableCtor = GConstructor<ISortable>;
export function Sortable<TBase extends GConstructor>(Base: TBase) {
  // @ts-ignore
  return class Sortable extends Base implements ISortable {
    #zIndex: number;

    constructor(attributes: Partial<ISortable> = {}) {
      super(attributes);

      if (!isUndefined(attributes.zIndex)) {
        this.#zIndex = attributes.zIndex;
      }
    }

    get zIndex() {
      return this.#zIndex;
    }
    set zIndex(zIndex: number) {
      if (this.#zIndex !== zIndex) {
        this.#zIndex = zIndex;
        this.renderDirtyFlag = true;

        if (this.parent) {
          this.parent.sortDirtyFlag = true;
        }
      }
    }
  };
}
