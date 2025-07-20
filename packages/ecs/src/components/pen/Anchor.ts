import { Entity, field } from '@lastolivegames/becsy';

export enum AnchorName {
  TOP_LEFT = 'top-left',
  TOP_RIGHT = 'top-right',
  BOTTOM_LEFT = 'bottom-left',
  BOTTOM_RIGHT = 'bottom-right',
  TOP_CENTER = 'top-center',
  MIDDLE_LEFT = 'middle-left',
  MIDDLE_RIGHT = 'middle-right',
  BOTTOM_CENTER = 'bottom-center',
  INSIDE = 'inside',
  OUTSIDE = 'outside',
  CONTROL = 'control',
}

export class Anchor {
  @field.ref declare camera: Entity;

  constructor(anchor?: Partial<Anchor>) {
    Object.assign(this, anchor);
  }
}
