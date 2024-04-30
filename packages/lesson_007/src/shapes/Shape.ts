import type { Buffer, Device, RenderPass } from '@antv/g-device-api';
import {
  Transform,
  Matrix,
  type ObservablePoint,
  type IPointData,
  type Rectangle,
  RAD_TO_DEG,
  DEG_TO_RAD,
} from '@pixi/math';
import EventEmitter from 'eventemitter3';
import { Cursor, FederatedEvent, FederatedEventTarget } from '../events';
import { isBoolean, isFunction, isObject } from '../utils';

export const IDENTITY_TRANSFORM = new Transform();

export interface ShapeAttributes {
  pointerEvents: PointerEvents;
  hitArea: Rectangle;
  cursor: Cursor;
  visible: boolean;
  renderable: boolean;
  draggable: boolean;
  droppable: boolean;
}

export abstract class Shape
  extends EventEmitter
  implements FederatedEventTarget
{
  /**
   * Avoid unnecessary work like updating Buffer by deferring it until needed.
   * @see https://gameprogrammingpatterns.com/dirty-flag.html
   */
  protected renderDirtyFlag = true;

  hitArea: Rectangle;
  /**
   * @see https://developer.mozilla.org/zh-CN/docs/Web/CSS/pointer-events
   */
  pointerEvents: PointerEvents;
  cursor: Cursor | string;
  visible: boolean;
  renderable: boolean;
  draggable: boolean;
  droppable: boolean;

  /**
   * World transform and local transform of this object.
   */
  transform = new Transform();

  parent: Shape | undefined;

  readonly children: Shape[] = [];

  constructor(attributes: Partial<ShapeAttributes> = {}) {
    super();

    this.cursor = attributes.cursor ?? 'default';
    this.hitArea = attributes.hitArea;
    this.pointerEvents = attributes.pointerEvents ?? 'auto';
    this.visible = attributes.visible ?? true;
    this.renderable = attributes.renderable ?? true;
    this.draggable = attributes.draggable ?? false;
    this.droppable = attributes.droppable ?? false;
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) {
    const capture =
      (isBoolean(options) && options) || (isObject(options) && options.capture);
    const signal = isObject(options) ? options.signal : undefined;
    const once = isObject(options) && options.once;
    const context = isFunction(listener) ? undefined : listener;

    type = capture ? `${type}capture` : type;
    const listenerFn = isFunction(listener) ? listener : listener.handleEvent;

    if (signal) {
      signal.addEventListener('abort', () => {
        this.off(type, listenerFn, context);
      });
    }

    if (once) {
      this.once(type, listenerFn, context);
    } else {
      this.on(type, listenerFn, context);
    }
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ) {
    const capture =
      (isBoolean(options) && options) || (isObject(options) && options.capture);
    const context = isFunction(listener) ? undefined : listener;

    type = capture ? `${type}capture` : type;
    listener = isFunction(listener) ? listener : listener?.handleEvent;

    this.off(type, listener, context);
  }

  dispatchEvent(e: Event) {
    if (!(e instanceof FederatedEvent)) {
      throw new Error(
        'Container cannot propagate events outside of the Federated Events API',
      );
    }

    e.defaultPrevented = false;
    e.path = null;
    e.target = this as unknown as FederatedEventTarget;
    e.manager.dispatchEvent(e);

    return !e.defaultPrevented;
  }

  abstract render(
    device: Device,
    renderPass: RenderPass,
    uniformBuffer: Buffer,
  ): void;

  abstract destroy(): void;

  abstract containsPoint(x: number, y: number): boolean;

  /**
   * Current transform of the object based on world (parent) factors.
   * @readonly
   */
  get worldTransform(): Matrix {
    return this.transform.worldTransform;
  }

  /**
   * Current transform of the object based on local factors: position, scale, other stuff.
   * @readonly
   */
  get localTransform(): Matrix {
    return this.transform.localTransform;
  }

  /**
   * The coordinate of the object relative to the local coordinates of the parent.
   */
  get position(): ObservablePoint {
    return this.transform.position;
  }
  set position(value: IPointData) {
    this.transform.position.copyFrom(value);
  }

  /**
   * The scale factors of this object along the local coordinate axes.
   *
   * The default scale is (1, 1).
   */
  get scale(): ObservablePoint {
    return this.transform.scale;
  }
  set scale(value: IPointData) {
    this.transform.scale.copyFrom(value);
  }

  /**
   * The center of rotation, scaling, and skewing for this display object in its local space. The `position`
   * is the projection of `pivot` in the parent's local space.
   *
   * By default, the pivot is the origin (0, 0).
   */
  get pivot(): ObservablePoint {
    return this.transform.pivot;
  }
  set pivot(value: IPointData) {
    this.transform.pivot.copyFrom(value);
  }

  /**
   * The skew factor for the object in radians.
   */
  get skew(): ObservablePoint {
    return this.transform.skew;
  }
  set skew(value: IPointData) {
    this.transform.skew.copyFrom(value);
  }

  /**
   * The rotation of the object in radians.
   * 'rotation' and 'angle' have the same effect on a display object; rotation is in radians, angle is in degrees.
   */
  get rotation(): number {
    return this.transform.rotation;
  }
  set rotation(value: number) {
    this.transform.rotation = value;
  }

  /**
   * The angle of the object in degrees.
   * 'rotation' and 'angle' have the same effect on a display object; rotation is in radians, angle is in degrees.
   */
  get angle(): number {
    return this.transform.rotation * RAD_TO_DEG;
  }
  set angle(value: number) {
    this.transform.rotation = value * DEG_TO_RAD;
  }

  appendChild(child: Shape) {
    if (child.parent) {
      child.parent.removeChild(child);
    }

    child.parent = this;
    child.transform._parentID = -1;
    this.children.push(child);

    return child;
  }

  removeChild(child: Shape) {
    const index = this.children.indexOf(child);

    if (index === -1) return null;

    child.parent = undefined;
    child.transform._parentID = -1;
    this.children.splice(index, 1);

    return child;
  }
}

export function isFillOrStrokeAffected(
  pointerEvents: PointerEvents,
  fill: string,
  stroke: string,
): [boolean, boolean] {
  let hasFill = false;
  let hasStroke = false;
  const isFillOtherThanNone = !!fill && fill !== 'none';
  const isStrokeOtherThanNone = !!stroke && stroke !== 'none';
  if (
    pointerEvents === 'visiblepainted' ||
    pointerEvents === 'painted' ||
    pointerEvents === 'auto'
  ) {
    hasFill = isFillOtherThanNone;
    hasStroke = isStrokeOtherThanNone;
  } else if (pointerEvents === 'visiblefill' || pointerEvents === 'fill') {
    hasFill = true;
  } else if (pointerEvents === 'visiblestroke' || pointerEvents === 'stroke') {
    hasStroke = true;
  } else if (pointerEvents === 'visible' || pointerEvents === 'all') {
    // The values of the fill and stroke do not affect event processing.
    hasFill = true;
    hasStroke = true;
  }

  return [hasFill, hasStroke];
}

type PointerEvents =
  | 'none'
  | 'auto'
  | 'stroke'
  | 'fill'
  | 'painted'
  | 'visible'
  | 'visiblestroke'
  | 'visiblefill'
  | 'visiblepainted'
  | 'all'
  | 'non-transparent-pixel';
