import type { Entity } from '@lastolivegames/becsy';
import {
  ComputedBounds,
  Material3D,
  Mesh3DNode,
  Mesh3DNodeTarget,
  Rect,
  Selected,
  Selected3D,
  Transform,
  Transform3D,
} from '../components';
import { createUnitCubeGeometry } from './extrude3d-geometry';
import type { Mesh3DNodeGeometry } from '../components/geometry3d/Mesh3DNode';
import { set3DMeshGizmoSelectedForCanvas } from './pick3d-bridge';

export function resolveMesh3DNodeGeometry(geometry: Mesh3DNodeGeometry = 'cube') {
  switch (geometry) {
    case 'cube':
      return createUnitCubeGeometry();
    default:
      return createUnitCubeGeometry();
  }
}

export function resolveMesh3DNodeScale(
  scale3d: number | [number, number, number],
): [number, number, number] {
  if (typeof scale3d === 'number') {
    return [scale3d, scale3d, scale3d];
  }
  return scale3d;
}

/** Declarative mesh3d source or companion entity (no {@link Selected3D} read). */
export function entityIsDeclarative3DNode(entity: Entity): boolean {
  return entity.has(Mesh3DNode) || entity.has(Mesh3DNodeTarget);
}

/** 3D 节点用 gizmo 操作，不展示 2D Transformer。 */
export function entityUses3DGizmoNotTransformer(entity: Entity): boolean {
  return entityIsDeclarative3DNode(entity) || entity.has(Selected3D);
}

/** Canvas-space center of a declarative {@link Mesh3DNode} source entity. */
export function resolveMesh3DNodeCanvasCenter(
  entity: Entity,
): [number, number] | undefined {
  if (entity.has(ComputedBounds)) {
    const bounds = entity.read(ComputedBounds).geometryWorldBounds;
    return [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2];
  }
  if (entity.has(Transform) && entity.has(Rect)) {
    const { x, y } = entity.read(Transform).translation;
    const { width, height } = entity.read(Rect);
    return [x + width / 2, y + height / 2];
  }
  return undefined;
}

/** Initial or updated companion {@link Transform3D} from a {@link Mesh3DNode} source. */
export function resolveMesh3DNodeCompanionTransform(
  source: Entity,
): Pick<Transform3D, 'translation' | 'rotation' | 'scale'> | undefined {
  if (!source.has(Mesh3DNode)) {
    return undefined;
  }
  const center = resolveMesh3DNodeCanvasCenter(source);
  if (!center) {
    return undefined;
  }
  const node = source.read(Mesh3DNode);
  const [centerX, centerY] = center;
  return {
    translation: [centerX, centerY, node.z],
    rotation: [...node.rotation3d],
    scale: resolveMesh3DNodeScale(node.scale3d),
  };
}

/** Sync companion mesh transform and material from its declarative source. */
export function syncMesh3DNodeCompanionFromSource(
  source: Entity,
  meshEntity: Entity,
): boolean {
  if (!source.has(Mesh3DNode)) {
    return false;
  }
  const center = resolveMesh3DNodeCanvasCenter(source);
  if (!center) {
    return false;
  }
  const node = source.read(Mesh3DNode);
  const [centerX, centerY] = center;
  Object.assign(meshEntity.write(Transform3D), {
    translation: [centerX, centerY, node.z],
    rotation: [...node.rotation3d],
    scale: resolveMesh3DNodeScale(node.scale3d),
  });

  const material = meshEntity.write(Material3D);
  material.baseColor = [...node.baseColor];
  material.ambient = node.ambient;
  material.diffuse = node.diffuse;
  material.specular = node.specular;
  material.shininess = node.shininess;
  return true;
}

/** When the declarative source has 2D {@link Selected}, mirror gizmo state on the companion mesh. */
export function ensureCompanionGizmoWhenSourceSelected(
  source: Entity,
  meshEntity: Entity,
  canvas: Entity,
): void {
  if (!source.has(Selected)) {
    return;
  }
  if (!meshEntity.has(Selected3D)) {
    meshEntity.add(Selected3D, {
      mode: 'transform',
      activeAxis: 'none',
      activePartKind: null,
      dragging: false,
    });
  }
  set3DMeshGizmoSelectedForCanvas(canvas, true);
}

export function parseMesh3DBaseColor(
  value: string | [number, number, number, number] | undefined,
  fallback: [number, number, number, number] = [1, 1, 1, 1],
): [number, number, number, number] {
  if (value == null) {
    return fallback;
  }
  if (Array.isArray(value)) {
    return value;
  }
  const s = value.trim();
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16) / 255;
      const g = parseInt(hex[1] + hex[1], 16) / 255;
      const b = parseInt(hex[2] + hex[2], 16) / 255;
      return [r, g, b, 1];
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      const a = hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return [r, g, b, a];
    }
  }
  const rgbMatch = s.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/,
  );
  if (rgbMatch) {
    const toUnit = (n: number) => (n > 1 ? n / 255 : n);
    return [
      toUnit(Number(rgbMatch[1])),
      toUnit(Number(rgbMatch[2])),
      toUnit(Number(rgbMatch[3])),
      rgbMatch[4] != null ? toUnit(Number(rgbMatch[4])) : 1,
    ];
  }
  return fallback;
}

export function parseLight3DColor(
  value: string | [number, number, number] | undefined,
  fallback: [number, number, number] = [1, 1, 1],
): [number, number, number] {
  if (Array.isArray(value)) {
    return value;
  }
  const rgba = parseMesh3DBaseColor(value, [...fallback, 1]);
  return [rgba[0], rgba[1], rgba[2]];
}
