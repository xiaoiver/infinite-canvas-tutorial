import { Selector } from '../../plugins';
import { Group } from '../Group';
import { Shape, ShapeAttributes } from '../Shape';

/**
 * fire custom event on target
 * @see http://fabricjs.com/docs/fabric.Object.html
 */
export enum SelectableEvent {
  SELECTED = 'selected',
  DESELECTED = 'deselected',

  /**
   * resized
   */
  RESIZED = 'resized',

  /**
   * dragend
   */
  MOVED = 'moved',

  /**
   * dragging
   */
  MOVING = 'moving',

  /**
   * deleted
   */
  DELETED = 'deleted',
}

export interface AbstractSelectableAttribtues extends ShapeAttributes {
  target: Shape;
  maskFill: string;
  maskFillOpacity: number;
  maskStroke: string;
  maskStrokeOpacity: number;
  maskStrokeWidth: number;
  maskOpacity: number;

  anchorFill: string;
  anchorFillOpacity: number;
  anchorSize: number;
  anchorStroke: string;
  anchorStrokeOpacity: number;
  anchorStrokeWidth: number;
  anchorOpacity: number;
}

export abstract class AbstractSelectable extends Group {
  protected target: Shape;
  plugin: Selector;

  #maskFill: string;
  #maskFillOpacity: number;
  #maskStroke: string;
  #maskStrokeOpacity: number;
  #maskStrokeWidth: number;
  #maskOpacity: number;

  #anchorSize: number;
  #anchorStroke: string;
  #anchorFill: string;
  #anchorFillOpacity: number;
  #anchorStrokeOpacity: number;
  #anchorStrokeWidth: number;
  #anchorOpacity: number;

  constructor(attributes: Partial<AbstractSelectableAttribtues>) {
    super(attributes);

    const {
      target,
      maskFill,
      maskFillOpacity,
      maskStroke,
      maskStrokeOpacity,
      maskStrokeWidth,
      maskOpacity,
      anchorSize,
      anchorStroke,
      anchorFill,
      anchorFillOpacity,
      anchorStrokeOpacity,
      anchorStrokeWidth,
      anchorOpacity,
    } = attributes;

    this.target = target;
    this.maskFill = maskFill ?? 'transparent';
    this.maskFillOpacity = maskFillOpacity ?? 1.0;
    this.maskStroke = maskStroke ?? 'black';
    this.maskStrokeOpacity = maskStrokeOpacity ?? 1.0;
    this.maskStrokeWidth = maskStrokeWidth ?? 1;
    this.maskOpacity = maskOpacity ?? 1.0;
    this.anchorSize = anchorSize ?? 4;
    this.anchorStroke = anchorStroke ?? 'black';
    this.anchorFill = anchorFill ?? 'transparent';
    this.anchorFillOpacity = anchorFillOpacity ?? 1;
    this.anchorStrokeOpacity = anchorStrokeOpacity ?? 1;
    this.anchorStrokeWidth = anchorStrokeWidth ?? 1;
    this.anchorOpacity = anchorOpacity ?? 1;

    this.init();
  }

  protected abstract init(): void;

  abstract triggerMovingEvent(dx: number, dy: number): void;

  abstract triggerMovedEvent(): void;

  get anchorSize() {
    return this.#anchorSize;
  }
  set anchorSize(anchorSize: number) {
    if (this.#anchorSize !== anchorSize) {
      this.#anchorSize = anchorSize;
    }
  }

  get anchorStroke() {
    return this.#anchorStroke;
  }
  set anchorStroke(anchorStroke: string) {
    if (this.#anchorStroke !== anchorStroke) {
      this.#anchorStroke = anchorStroke;
    }
  }

  get anchorFill() {
    return this.#anchorFill;
  }
  set anchorFill(anchorFill: string) {
    if (this.#anchorFill !== anchorFill) {
      this.#anchorFill = anchorFill;
    }
  }

  get anchorFillOpacity() {
    return this.#anchorFillOpacity;
  }
  set anchorFillOpacity(anchorFillOpacity: number) {
    if (this.#anchorFillOpacity !== anchorFillOpacity) {
      this.#anchorFillOpacity = anchorFillOpacity;
    }
  }

  get anchorStrokeOpacity() {
    return this.#anchorStrokeOpacity;
  }
  set anchorStrokeOpacity(anchorStrokeOpacity: number) {
    if (this.#anchorStrokeOpacity !== anchorStrokeOpacity) {
      this.#anchorStrokeOpacity = anchorStrokeOpacity;
    }
  }

  get anchorStrokeWidth() {
    return this.#anchorStrokeWidth;
  }
  set anchorStrokeWidth(anchorStrokeWidth: number) {
    if (this.#anchorStrokeWidth !== anchorStrokeWidth) {
      this.#anchorStrokeWidth = anchorStrokeWidth;
    }
  }

  get anchorOpacity() {
    return this.#anchorFillOpacity;
  }
  set anchorOpacity(anchorOpacity: number) {
    if (this.#anchorOpacity !== anchorOpacity) {
      this.#anchorOpacity = anchorOpacity;
    }
  }

  get maskFill() {
    return this.#maskFill;
  }
  set maskFill(maskFill: string) {
    if (this.#maskFill !== maskFill) {
      this.#maskFill = maskFill;
    }
  }

  get maskFillOpacity() {
    return this.#maskFillOpacity;
  }
  set maskFillOpacity(maskFillOpacity: number) {
    if (this.#maskFillOpacity !== maskFillOpacity) {
      this.#maskFillOpacity = maskFillOpacity;
    }
  }

  get maskStroke() {
    return this.#maskStroke;
  }
  set maskStroke(maskStroke: string) {
    if (this.#maskStroke !== maskStroke) {
      this.#maskStroke = maskStroke;
    }
  }

  get maskStrokeOpacity() {
    return this.#maskStrokeOpacity;
  }
  set maskStrokeOpacity(maskStrokeOpacity: number) {
    if (this.#maskStrokeOpacity !== maskStrokeOpacity) {
      this.#maskStrokeOpacity = maskStrokeOpacity;
    }
  }

  get maskStrokeWidth() {
    return this.#maskStrokeWidth;
  }
  set maskStrokeWidth(maskStrokeWidth: number) {
    if (this.#maskStrokeWidth !== maskStrokeWidth) {
      this.#maskStrokeWidth = maskStrokeWidth;
    }
  }

  get maskOpacity() {
    return this.#maskOpacity;
  }
  set maskOpacity(maskOpacity: number) {
    if (this.#maskOpacity !== maskOpacity) {
      this.#maskOpacity = maskOpacity;
    }
  }
}
