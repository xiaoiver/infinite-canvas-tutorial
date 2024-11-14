import { Group } from '../Group';
import { Shape, ShapeAttributes } from '../Shape';

export interface AbstractSelectableAttribtues extends ShapeAttributes {
  target: Shape;
}

export abstract class AbstractSelectable extends Group {
  protected target: Shape;

  constructor(attributes: Partial<AbstractSelectableAttribtues>) {
    super(attributes);

    this.target = attributes.target;

    this.init();
  }

  protected abstract init(): void;
}
