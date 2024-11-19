import { Transform, Matrix } from '@pixi/math';
import { isUndefined, uid } from '../utils';
import {
  FederatedEventTarget,
  FederatedOptions,
  PointerEvents,
} from '../events';
import { AABB } from './AABB';
import { EventTarget } from './mixins/EventTarget';
import { IRenderable, Renderable } from './mixins/Renderable';
import { ITransformable, Transformable } from './mixins/Transformable';
import { ISortable, Sortable } from './mixins/Sortable';
import { GConstructor } from './mixins';

export const IDENTITY_TRANSFORM = new Transform();
const pooledMatrix = new Matrix();

export interface ShapeAttributes
  extends FederatedOptions,
    IRenderable,
    ITransformable,
    ISortable {}

export interface Shape
  extends FederatedEventTarget,
    IRenderable,
    ITransformable,
    ISortable {
  /**
   * Unique ID
   */
  uid: number;

  /**
   * The read-only property returns the parent of the specified node in scenegraph.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Node/parentNode
   */
  parent?: Shape;

  /**
   * The read-only children property.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/children
   */
  children: Shape[];

  sorted: Shape[];

  geometryDirtyFlag: boolean;

  materialDirtyFlag: boolean;

  /**
   * Hit testing.
   */
  containsPoint(
    x: number,
    y: number,
    ctx?: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  ): boolean;

  getBounds(): AABB;
  getGeometryBounds(): AABB;
  getRenderBounds(): AABB;

  /**
   * Adds a node to the end of the list of children of a specified parent node.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Node/appendChild
   */
  appendChild(child: Shape): Shape;

  /**
   * Removes a child node from the scenegraph and returns the removed node.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Node/removeChild
   */
  removeChild(child: Shape): Shape | null;
}

// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const Shape = Shapable(Renderable(Sortable(Transformable(EventTarget))));

function Shapable<TBase extends GConstructor<Shape>>(Base: TBase) {
  // @ts-ignore
  abstract class S extends Base {
    /**
     * A unique identifier for this object.
     */
    uid = uid();

    parent?: Shape;

    readonly children: Shape[] = [];

    geometryDirtyFlag = true;
    materialDirtyFlag = true;

    constructor(attributes: Partial<ShapeAttributes> = {}) {
      super(attributes);
    }

    abstract containsPoint(x: number, y: number): boolean;
    abstract getGeometryBounds(): AABB;
    abstract getRenderBounds(): AABB;

    appendChild(child: Shape) {
      if (child.parent) {
        child.parent.removeChild(child);
      }

      child.parent = this;
      child.transform._parentID = -1;
      this.children.push(child);

      if (!isUndefined(child.zIndex)) {
        this.sortDirtyFlag = true;
      }

      return child;
    }

    removeChild(child: Shape) {
      const index = this.children.indexOf(child);

      if (index === -1) return null;

      child.parent = undefined;
      child.transform._parentID = -1;
      this.children.splice(index, 1);

      if (this.sorted?.length) {
        const index = this.sorted.indexOf(child);
        if (index !== -1) {
          this.sorted.splice(index, 1);
        }
      }

      if (!isUndefined(child.zIndex)) {
        this.sortDirtyFlag = true;
      }

      return child;
    }

    getBounds(skipUpdateTransform?: boolean) {
      if (!this.boundsDirtyFlag && !this.transformDirtyFlag) {
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

  return S;
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

export function strokeOffset(
  strokeAlignment: 'center' | 'inner' | 'outer',
  strokeWidth: number,
) {
  if (strokeAlignment === 'center') {
    return strokeWidth / 2;
  } else if (strokeAlignment === 'inner') {
    return 0;
  } else if (strokeAlignment === 'outer') {
    return strokeWidth;
  }
  return 0;
}

export function isFillOrStrokeAffected(
  pointerEvents: PointerEvents,
  fill: string | TexImageSource,
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

export function hasValidStroke(stroke: string, strokeWidth: number) {
  return !!stroke && strokeWidth > 0;
}

export function sortByZIndex(a: Shape, b: Shape) {
  const zIndex1 = a.zIndex ?? 0;
  const zIndex2 = b.zIndex ?? 0;
  if (zIndex1 === zIndex2) {
    const parent = a.parent;
    if (parent) {
      const children = parent.children || [];
      return children.indexOf(a) - children.indexOf(b);
    }
  }
  return zIndex1 - zIndex2;
}

export interface RBushNodeAABB {
  shape: Shape;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
