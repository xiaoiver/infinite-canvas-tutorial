import type { Entity } from '@lastolivegames/becsy';
import { mat4 } from 'gl-matrix';
import {
  ComputedBounds,
  Extrude3D,
  GlobalTransform,
  Path,
  type Transform3D,
} from '../components';
import { resolveCanvasSourceOrigin } from './canvas-source-origin';
import { pathExtrusionGeometry } from './path-extrusion-source';
import { rectExtrusionIsBaked } from './rect-extrusion-source';

type Pose = Pick<Transform3D, 'translation' | 'rotation' | 'scale'>;
const zero = (value: number) => (Math.abs(value) < 1e-7 ? 0 : value);
function euler(matrix: mat4): [number, number, number] {
  const y = Math.asin(Math.max(-1, Math.min(1, matrix[8])));
  return (
    Math.abs(matrix[8]) < 0.9999999
      ? [
          Math.atan2(-matrix[9], matrix[10]),
          y,
          Math.atan2(-matrix[4], matrix[0]),
        ]
      : [Math.atan2(matrix[6], matrix[5]), y, 0]
  ).map(zero) as [number, number, number];
}
function rotated(base: number, rotation: readonly number[]) {
  const result = mat4.fromZRotation(mat4.create(), base);
  mat4.rotateX(result, result, rotation[0]);
  mat4.rotateY(result, result, rotation[1]);
  mat4.rotateZ(result, result, rotation[2]);
  return result;
}

export function resolveExtrudeCompanionTransform(
  source: Entity,
  unifiedSpace: boolean,
): Pose | undefined {
  if (!source.has(ComputedBounds) || !source.has(Extrude3D)) return;
  const { geometryWorldBounds: bounds, transformOBB } =
    source.read(ComputedBounds);
  const baseRotation = transformOBB.rotation;
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (!(width > 0 && height > 0)) return;
  const { depth, z, rotation } = source.read(Extrude3D);
  if (source.has(Path)) {
    if (!source.has(GlobalTransform)) return;
    const pathMesh = pathExtrusionGeometry(source);
    if (!pathMesh) return;
    const { m00, m01, m10, m11, m20, m21 } =
      source.read(GlobalTransform).matrix;
    const [cx, cy] = pathMesh.center;
    if (pathMesh.bakedTransform) {
      const cos = Math.cos(baseRotation);
      const sin = Math.sin(baseRotation);
      return {
        translation: [
          m20 + cos * cx - sin * cy,
          (m21 + sin * cx + cos * cy) * (unifiedSpace ? 1 : -1),
          z - depth / 2,
        ],
        rotation: euler(rotated(baseRotation, rotation)),
        scale: [1, 1, depth],
      };
    }
    return {
      translation: [
        m00 * cx + m10 * cy + m20,
        (m01 * cx + m11 * cy + m21) * (unifiedSpace ? 1 : -1),
        z - depth / 2,
      ],
      rotation: euler(rotated(baseRotation, rotation)),
      scale: [transformOBB.scaleX, transformOBB.scaleY, depth],
    };
  }
  if (!source.has(GlobalTransform)) return;
  const { geometryBounds } = source.read(ComputedBounds);
  const [cx, cy] = [
    (geometryBounds.minX + geometryBounds.maxX) / 2,
    (geometryBounds.minY + geometryBounds.maxY) / 2,
  ];
  const { m00, m01, m10, m11, m20, m21 } = source.read(GlobalTransform).matrix;
  const baked = rectExtrusionIsBaked(source);
  return {
    translation: [
      m00 * cx + m10 * cy + m20,
      (m01 * cx + m11 * cy + m21) * (unifiedSpace ? 1 : -1),
      z - depth / 2,
    ],
    rotation: euler(rotated(baseRotation, rotation)),
    scale: baked
      ? [1, 1, depth]
      : [
          (geometryBounds.maxX - geometryBounds.minX) * Math.hypot(m00, m01),
          (geometryBounds.maxY - geometryBounds.minY) * Math.hypot(m10, m11),
          depth,
        ],
  };
}

/** XY edits the source origin; Z changes elevation, never extrusion thickness. */
export function resolveExtrudeSourceTransform(
  source: Entity,
  pose: Pose,
  unifiedSpace: boolean,
) {
  if (!source.has(Extrude3D) || !source.has(ComputedBounds)) return;
  if (
    ![...pose.translation, ...pose.rotation, ...pose.scale].every(
      Number.isFinite,
    ) ||
    pose.scale[2] <= 0
  )
    return;
  const pathMesh = source.has(Path) ? pathExtrusionGeometry(source) : undefined;
  const localCenter = pathMesh?.sourceCenter ?? pathMesh?.center;
  if (source.has(Path) && !localCenter) return;
  const origin = resolveCanvasSourceOrigin(
    source,
    [pose.translation[0], pose.translation[1] * (unifiedSpace ? 1 : -1)],
    localCenter,
  );
  if (!origin) return;
  const base = source.read(ComputedBounds).transformOBB.rotation;
  const localRotation = mat4.multiply(
    mat4.create(),
    mat4.fromZRotation(mat4.create(), -base),
    rotated(0, pose.rotation),
  );
  return {
    ...origin,
    extrude: {
      depth: pose.scale[2],
      z: zero(pose.translation[2] + pose.scale[2] / 2),
      rotation: euler(localRotation),
    },
  };
}
