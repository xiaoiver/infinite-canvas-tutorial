import type { Entity } from '@lastolivegames/becsy';
import { mat4, vec3 } from 'gl-matrix';
import { Extrude3D, GlobalTransform, Path, Transform3D } from '../components';
import { pathExtrusionGeometry } from './path-extrusion-source';
import { isEntityAlive } from '../systems/Transform';

export interface PathAnchor3DPlane {
  origin: [number, number, number];
  xAxis: [number, number, number];
  yAxis: [number, number, number];
  normal: [number, number, number];
}

/** The source Path's local XY plane as placed on its companion mesh's front cap. */
export function pathAnchor3DPlane(source: Entity): PathAnchor3DPlane | null {
  if (
    !source.has(Path) ||
    !source.has(Extrude3D) ||
    !source.has(GlobalTransform)
  )
    return null;
  const mesh = source.read(Extrude3D).meshEntity;
  if (!mesh || !isEntityAlive(mesh) || !mesh.has(Transform3D)) return null;
  const geometry = pathExtrusionGeometry(source);
  if (!geometry) return null;
  const pose = mesh.read(Transform3D);
  const model = mat4.create();
  mat4.translate(model, model, pose.translation);
  mat4.rotateX(model, model, pose.rotation[0]);
  mat4.rotateY(model, model, pose.rotation[1]);
  mat4.rotateZ(model, model, pose.rotation[2]);
  mat4.scale(model, model, pose.scale);

  let a = 1;
  let b = 0;
  let c = 0;
  let d = 1;
  if (geometry.bakedTransform) {
    const { m00, m01, m10, m11 } = source.read(GlobalTransform).matrix;
    const angle = Math.atan2(m01, m00);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    a = cos * m00 + sin * m01;
    b = -sin * m00 + cos * m01;
    c = cos * m10 + sin * m11;
    d = -sin * m10 + cos * m11;
  }
  const point = vec3.transformMat4(
    vec3.create(),
    [-geometry.center[0], -geometry.center[1], 0.5],
    model,
  );
  const origin: [number, number, number] = [point[0], point[1], point[2]];
  const xAxis = vec3.fromValues(
    model[0] * a + model[4] * b,
    model[1] * a + model[5] * b,
    model[2] * a + model[6] * b,
  );
  const yAxis = vec3.fromValues(
    model[0] * c + model[4] * d,
    model[1] * c + model[5] * d,
    model[2] * c + model[6] * d,
  );
  const normal = vec3.cross(vec3.create(), xAxis, yAxis);
  const area = vec3.length(normal);
  if (!Number.isFinite(area) || area < 1e-8) return null;
  vec3.scale(normal, normal, 1 / area);
  return {
    origin,
    xAxis: [xAxis[0], xAxis[1], xAxis[2]],
    yAxis: [yAxis[0], yAxis[1], yAxis[2]],
    normal: [normal[0], normal[1], normal[2]],
  };
}

export function pathAnchor3DWorldPoint(
  plane: PathAnchor3DPlane,
  point: readonly [number, number],
): [number, number, number] {
  return [0, 1, 2].map(
    (axis) =>
      plane.origin[axis] +
      plane.xAxis[axis] * point[0] +
      plane.yAxis[axis] * point[1],
  ) as [number, number, number];
}

/** Solve the two in-plane coordinates without assuming orthogonal basis axes. */
export function pathAnchor3DLocalPoint(
  plane: PathAnchor3DPlane,
  world: readonly [number, number, number],
): [number, number] | null {
  const relative = vec3.subtract(vec3.create(), world, plane.origin);
  const xx = vec3.dot(plane.xAxis, plane.xAxis);
  const xy = vec3.dot(plane.xAxis, plane.yAxis);
  const yy = vec3.dot(plane.yAxis, plane.yAxis);
  const determinant = xx * yy - xy * xy;
  if (!Number.isFinite(determinant) || determinant < xx * yy * 1e-12)
    return null;
  const rx = vec3.dot(relative, plane.xAxis);
  const ry = vec3.dot(relative, plane.yAxis);
  const point: [number, number] = [
    (yy * rx - xy * ry) / determinant,
    (xx * ry - xy * rx) / determinant,
  ];
  return point.every(Number.isFinite) ? point : null;
}
