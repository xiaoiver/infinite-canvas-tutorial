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
import { isBoolean, isFunction, isObject, uid } from '../utils';
import { AABB } from './AABB';

export const IDENTITY_TRANSFORM = new Transform();
const pooledMatrix = new Matrix();

export interface ShapeAttributes {
  pointerEvents: PointerEvents;
  hitArea: Rectangle;
  cursor: Cursor;
  visible: boolean;
  renderable: boolean;
  cullable: boolean;
  draggable: boolean;
  droppable: boolean;
  batchable: boolean;
}

export abstract class Shape
  extends EventEmitter
  implements FederatedEventTarget
{
  /**
   * A unique identifier for this object.
   */
  uid = uid();

  /**
   * The global render order of this object.
   * A higher value will render over the top of lower values.
   * by {@link Renderer} plugin.
   */
  globalRenderOrder: number;

  /**
   * Avoid unnecessary work like updating Buffer by deferring it until needed.
   * @see https://gameprogrammingpatterns.com/dirty-flag.html
   */
  protected renderDirtyFlag = true;

  /**
   * The bounding box of the geometry.
   */
  protected geometryBounds: AABB;
  protected geometryBoundsDirtyFlag = true;

  /**
   * The bounding box of the render.
   */
  protected renderBounds: AABB;
  protected renderBoundsDirtyFlag = true;

  /**
   * The bounding box of the hit area.
   */
  hitArea: Rectangle | undefined;

  /**
   * @see https://developer.mozilla.org/zh-CN/docs/Web/CSS/pointer-events
   */
  pointerEvents: PointerEvents;

  /**
   * The cursor to be displayed when the mouse pointer is over the object.
   */
  cursor: Cursor | string;

  /**
   * Whether this object is visible.
   */
  visible: boolean;

  /**
   * Whether this object is renderable.
   */
  renderable: boolean;

  /**
   * Whether this object is draggable. Used in {@link DragAndDrop} plugin.
   */
  draggable: boolean;

  /**
   * Whether this object is droppable. Used in {@link DragAndDrop} plugin.
   */
  droppable: boolean;

  /**
   * Whether this object should be culled by the {@link Culling} plugin.
   */
  cullable: boolean;
  /**
   * Whether this object is culled by the {@link Culling} plugin.
   */
  culled: boolean;

  /**
   * Use instanced rendering to reduce the number of draw calls.
   */
  batchable: boolean;

  /**
   * World transform and local transform of this object.
   */
  transform = new Transform();

  parent?: Shape;

  readonly children: Shape[] = [];

  constructor(attributes: Partial<ShapeAttributes> = {}) {
    super();

    this.cursor = attributes.cursor ?? 'default';
    this.hitArea = attributes.hitArea;
    this.pointerEvents = attributes.pointerEvents ?? 'auto';
    this.visible = attributes.visible ?? true;
    this.renderable = attributes.renderable ?? true;
    this.cullable = attributes.cullable ?? true;
    this.draggable = attributes.draggable ?? false;
    this.droppable = attributes.droppable ?? false;
    this.batchable = attributes.batchable ?? false;
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
    e.path = [];
    e.target = this as unknown as FederatedEventTarget;
    e.manager.dispatchEvent(e);

    return !e.defaultPrevented;
  }

  abstract containsPoint(x: number, y: number): boolean;

  abstract getGeometryBounds(): AABB;
  abstract getRenderBounds(): AABB;

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

  getBounds(skipUpdateTransform?: boolean, bounds?: AABB) {
    bounds = bounds || new AABB();
    bounds.clear();

    let parentTransform: Matrix;
    if (this.parent) {
      if (!skipUpdateTransform) {
        pooledMatrix.identity();
        parentTransform = updateTransformBackwards(this, pooledMatrix);
      } else {
        parentTransform = this.parent.worldTransform;
      }
    } else {
      parentTransform = Matrix.IDENTITY;
    }

    getBounds(this, bounds, parentTransform, skipUpdateTransform);

    return bounds;
  }
}

export function getBounds(
  target: Shape,
  bounds: AABB,
  parentTransform: Matrix,
  skipUpdateTransform?: boolean,
) {
  if (!target.visible) return;

  let worldTransform: Matrix;

  if (!skipUpdateTransform) {
    target.transform.updateLocalTransform();

    worldTransform = new Matrix();
    worldTransform.copyFrom(target.localTransform);
    worldTransform.append(parentTransform);
  } else {
    worldTransform = target.worldTransform;
  }

  if (target.renderable) {
    bounds.matrix = worldTransform;
    bounds.addBounds(target.getRenderBounds());
  }

  for (let i = 0; i < target.children.length; i++) {
    getBounds(target.children[i], bounds, worldTransform, skipUpdateTransform);
  }
}

function updateTransformBackwards(target: Shape, parentTransform: Matrix) {
  const parent = target.parent;

  if (parent) {
    updateTransformBackwards(parent, parentTransform);
    parent.transform.updateLocalTransform();
    parentTransform.append(parent.localTransform);
  }

  return parentTransform;
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

export interface RBushNodeAABB {
  shape: Shape;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
