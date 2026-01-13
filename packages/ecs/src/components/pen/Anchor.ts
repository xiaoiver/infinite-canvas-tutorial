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
  X1Y1 = 'x1y1',
  X2Y2 = 'x2y2',
}

export class Anchor {
  @field.ref declare camera: Entity;

  constructor(anchor?: Partial<Anchor>) {
    Object.assign(this, anchor);
  }
}
