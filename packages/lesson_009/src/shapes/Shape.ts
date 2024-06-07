import {
  Transform,
  Matrix,
  type Rectangle,
} from '@pixi/math';
import { uid } from '../utils';
import { Cursor } from '../events';
import { AABB } from './AABB';
import { EventTarget } from './mixins/EventTarget';
import { Renderable } from './mixins/Renderable';
import { Transformable } from './mixins/Transformable';

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
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  fillOpacity: number;
  strokeOpacity: number;
}

// @see https://www.typescriptlang.org/docs/handbook/mixins.html#constrained-mixins
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface Shape extends EventTarget, Renderable, Transformable {}
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export abstract class Shape
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
   * The bounding box of the hit area.
   */
  hitArea: Rectangle | undefined;

  /**
   * @see https://developer.mozilla.org/zh-CN/docs/Web/CSS/pointer-events
   */
  pointerEvents: PointerEvents;

  /**
   * Whether this object is visible.
   */
  visible: boolean;

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

  constructor(attributes: Partial<ShapeAttributes> = {}) {
    const {
      cursor,
      hitArea,
      visible,
      renderable,
      cullable,
      draggable,
      droppable,
      batchable,
      pointerEvents,
      fill,
      stroke,
      strokeWidth,
      opacity,
      fillOpacity,
      strokeOpacity,
    } = attributes;

    this.cursor = cursor ?? 'default';
    this.hitArea = hitArea;
    this.pointerEvents = pointerEvents ?? 'auto';
    this.visible = visible ?? true;
    this.renderable = renderable ?? true;
    this.cullable = cullable ?? true;
    this.draggable = draggable ?? false;
    this.droppable = droppable ?? false;
    this.batchable = batchable ?? false;
    this.fill = fill ?? 'black';
    this.stroke = stroke ?? 'black';
    this.strokeWidth = strokeWidth ?? 0;
    this.opacity = opacity ?? 1;
    this.fillOpacity = fillOpacity ?? 1;
    this.strokeOpacity = strokeOpacity ?? 1;
  }

  abstract containsPoint(x: number, y: number): boolean;
  abstract getRenderBounds(): AABB;

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

  getBounds(skipUpdateTransform?: boolean) {
    if (!this.boundsDirtyFlag) {
      return this.bounds;
    }

    this.bounds = this.bounds || new AABB();
    this.bounds.clear();

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

    getBounds(this, this.bounds, parentTransform, skipUpdateTransform);

    this.boundsDirtyFlag = false;
    return this.bounds;
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
