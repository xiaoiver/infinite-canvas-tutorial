import type { Buffer, Device, RenderPass } from '@antv/g-device-api';
import {
  Transform,
  type Matrix,
  type ObservablePoint,
  type IPointData,
  RAD_TO_DEG,
  DEG_TO_RAD,
} from '@pixi/math';

export const IDENTITY_TRANSFORM = new Transform();

export abstract class Shape {
  /**
   * Avoid unnecessary work like updating Buffer by deferring it until needed.
   * @see https://gameprogrammingpatterns.com/dirty-flag.html
   */
  protected renderDirtyFlag = true;

  /**
   * World transform and local transform of this object.
   */
  transform = new Transform();

  /**
   * Parent of this object.
   */
  parent: Shape | undefined;

  readonly children: Shape[] = [];

  abstract render(
    device: Device,
    renderPass: RenderPass,
    uniformBuffer: Buffer,
  ): void;

  abstract destroy(): void;

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
