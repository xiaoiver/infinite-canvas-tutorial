import { field } from '@lastolivegames/becsy';
import { AABB, aabbType, OBB, obbType } from '../math';

export class ComputedBounds {
  /**
   * The bounding box of the render.
   * e.g. Stroke / Shadow included.
   */
  @field(aabbType) declare renderBounds: AABB;

  /**
   * The bounding box of the geometry.
   * e.g. Stroke excluded.
   */
  @field(aabbType) declare geometryBounds: AABB;

  /**
   * Account for world transform.
   */
  @field(aabbType) declare renderWorldBounds: AABB;

  /**
   * Account for world transform.
   */
  @field(aabbType) declare geometryWorldBounds: AABB;

  /**
   * 与 Transform / Konva 式 resize 一致：decompose(GlobalTransform) 的平移 + 局部几何宽高 + rotation/scale。
   */
  @field(obbType) declare transformOBB: OBB;

  /**
   * 选中框、变换器、getOBB：普通图元与 transformOBB 相同；Group 为世界轴对齐子并集包络。
   */
  @field(obbType) declare selectionOBB: OBB;
}
