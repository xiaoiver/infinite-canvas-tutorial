import type { Entity } from '@lastolivegames/becsy';
import { mat4 } from 'gl-matrix';
import { ComputedBounds, Extrude3D, type Transform3D } from '../components';
import { resolveCanvasSourceOrigin } from './canvas-source-origin';

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
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (!(width > 0 && height > 0)) return;
  const { depth, z, rotation } = source.read(Extrude3D);
  return {
    translation: [
      (bounds.minX + bounds.maxX) / 2,
      ((bounds.minY + bounds.maxY) / 2) * (unifiedSpace ? 1 : -1),
      z - depth / 2,
    ],
    rotation: euler(rotated(transformOBB.rotation, rotation)),
    scale: [width, height, depth],
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
  const origin = resolveCanvasSourceOrigin(source, [
    pose.translation[0],
    pose.translation[1] * (unifiedSpace ? 1 : -1),
  ]);
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
