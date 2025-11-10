import { field, Type } from '@lastolivegames/becsy';

export class HTMLContainer {
  /**
   * HTML container.
   */
  @field({ type: Type.object, default: null })
  declare element: HTMLElement | null;

  constructor(props?: Partial<HTMLContainer>) {
    if (props) {
      Object.assign(this, props);
    }
  }
}
