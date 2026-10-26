import { mat4, vec3 } from 'gl-matrix';
import type { GizmoPose } from '../systems/pick3d/gizmo-gesture';

/** A multi-selection uses one world-aligned gizmo at its center. */
export function groupGizmoPose(
  poses: readonly GizmoPose[],
): GizmoPose | undefined {
  if (!poses.length) return;
  const translation: [number, number, number] = [0, 0, 0];
  for (const pose of poses) {
    for (let axis = 0; axis < 3; axis++)
      translation[axis] += pose.translation[axis] / poses.length;
  }
  return { translation, rotation: [0, 0, 0], scale: [1, 1, 1] };
}

function rotationMatrix(rotation: readonly number[]): mat4 {
  const matrix = mat4.create();
  mat4.rotateX(matrix, matrix, rotation[0]);
  mat4.rotateY(matrix, matrix, rotation[1]);
  mat4.rotateZ(matrix, matrix, rotation[2]);
  return matrix;
}

function eulerFromMatrix(matrix: mat4): [number, number, number] {
  const y = Math.asin(Math.max(-1, Math.min(1, matrix[8])));
  return Math.abs(matrix[8]) < 0.9999999
    ? [Math.atan2(-matrix[9], matrix[10]), y, Math.atan2(-matrix[4], matrix[0])]
    : [Math.atan2(matrix[6], matrix[5]), y, 0];
}

/** Apply a group gesture around the shared pivot. */
export function groupMemberPose(
  member: GizmoPose,
  initial: GizmoPose,
  current: GizmoPose,
): GizmoPose {
  const factor = current.scale[0] / initial.scale[0];
  if (current.rotation.every((angle, axis) => angle === initial.rotation[axis]))
    return {
      translation: member.translation.map(
        (value, axis) =>
          current.translation[axis] +
          (value - initial.translation[axis]) * factor,
      ) as [number, number, number],
      rotation: [...member.rotation],
      scale: member.scale.map((value) => value * factor) as [
        number,
        number,
        number,
      ],
    };
  const initialRotation = rotationMatrix(initial.rotation);
  const currentRotation = rotationMatrix(current.rotation);
  const inverse = mat4.invert(mat4.create(), initialRotation)!;
  const delta = mat4.multiply(mat4.create(), currentRotation, inverse);
  const offset = vec3.subtract(
    vec3.create(),
    member.translation,
    initial.translation,
  );
  vec3.transformMat4(offset, offset, delta);
  const orientation = mat4.multiply(
    mat4.create(),
    delta,
    rotationMatrix(member.rotation),
  );
  return {
    translation: [
      current.translation[0] + offset[0] * factor,
      current.translation[1] + offset[1] * factor,
      current.translation[2] + offset[2] * factor,
    ],
    rotation: eulerFromMatrix(orientation),
    scale: member.scale.map((value) => value * factor) as [
      number,
      number,
      number,
    ],
  };
}
