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
   * decompose(GlobalTransform) 的平移 + 局部几何宽高 + rotation/scale（与实体局部原点一致）。
   * Hover 高亮等直接复用局部 Polyline/Path 点时使用。
   */
  @field(obbType) declare transformOBB: OBB;

  /**
   * 选中框、变换器、getOBB。Group 为世界轴对齐子并集包络；
   * Polyline/Path/Line 为包围盒 min 角对齐的世界坐标，便于 Rect mask。
   */
  @field(obbType) declare selectionOBB: OBB;
}
