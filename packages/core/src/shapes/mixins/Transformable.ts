import {
  Transform,
  Matrix,
  type ObservablePoint,
  type IPointData,
  RAD_TO_DEG,
  DEG_TO_RAD,
} from '@pixi/math';
import { GConstructor } from '.';

export interface ITransformable {
  /**
   * World transform and local transform of this object.
   */
  transform: Transform;

  transformDirtyFlag: boolean;

  /**
   * Current transform of the object based on world (parent) factors.
   * @readonly
   */
  worldTransform: Matrix;

  /**
   * Current transform of the object based on local factors: position, scale, other stuff.
   * @readonly
   */
  localTransform: Matrix;

  /**
   * The coordinate of the object relative to the local coordinates of the parent.
   */
  get position(): ObservablePoint;
  set position(value: IPointData);

  /**
   * The scale factors of this object along the local coordinate axes.
   *
   * The default scale is (1, 1).
   */
  get scale(): ObservablePoint;
  set scale(value: IPointData);

  /**
   * The pivot for the object in radians.
   */
  get pivot(): ObservablePoint;
  set pivot(value: IPointData);

  /**
   * The skew factor for the object in radians.
   */
  get skew(): ObservablePoint;
  set skew(value: IPointData);

  get rotation(): number;
  set rotation(value: number);

  get angle(): number;
  set angle(value: number);
}

export type TransformableCtor = GConstructor<ITransformable>;
export function Transformable<TBase extends GConstructor>(Base: TBase) {
  return class Transformable extends Base {
    transform = new Transform();

    get worldTransform(): Matrix {
      return this.transform.worldTransform;
    }

    get localTransform(): Matrix {
      return this.transform.localTransform;
    }

    get position(): ObservablePoint {
      return this.transform.position;
    }
    set position(value: IPointData) {
      this.transform.position.copyFrom(value);
    }

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

    get transformDirtyFlag() {
      return (
        this.transform['_localID'] !== this.transform['_currentLocalID'] ||
        (this.parent &&
          this.transform['_parentID'] !== this.parent.transform['_worldID'])
      );
    }
  };
}
