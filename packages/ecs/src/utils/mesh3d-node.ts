import type { Entity } from '@lastolivegames/becsy';
import { mat3 } from 'gl-matrix';
import {
  Camera,
  Children,
  GlobalTransform,
  Mat3,
  ComputedBounds,
  Material3D,
  Mesh3D,
  Mesh3DNode,
  Mesh3DNodeTarget,
  Rect,
  Selected,
  Selected3D,
  Transform,
  Transform3D,
} from '../components';
import {
  createGeometry,
  emptyMesh3DGeometry,
  geometrySpecKey,
  isGltfGeometrySpec,
  mesh3DGeometryDataEquals,
  normalizeGeometry,
  type Mesh3DNodeGeometry,
} from './geometry3d';
import { set3DMeshGizmoSelectedForCanvas } from './pick3d-bridge';
import type { GltfMeshBakeResult } from './gltf/bake-gltf-mesh';

type ImportedMaterial = Pick<GltfMeshBakeResult, 'baseColor' | 'map'>;
const companionGeometry = new WeakMap<
  Entity,
  { key: string; material?: ImportedMaterial }
>();

export function resolveMesh3DNodeGeometry(
  geometry: Mesh3DNodeGeometry = 'cube',
) {
  const spec = normalizeGeometry(geometry);
  if (isGltfGeometrySpec(spec)) {
    return emptyMesh3DGeometry();
  }
  return createGeometry(spec);
}

export function rebuildMesh3DNodeCompanionGeometry(
  source: Entity,
  meshEntity: Entity,
): boolean {
  if (!source.has(Mesh3DNode) || !meshEntity.has(Mesh3D)) {
    return false;
  }
  const spec = normalizeGeometry(source.read(Mesh3DNode).geometry);
  const key = geometrySpecKey(spec);
  if (isGltfGeometrySpec(spec)) {
    if (companionGeometry.get(source)?.key === key) {
      return false;
    }
    companionGeometry.delete(source);
    Object.assign(meshEntity.write(Mesh3D), emptyMesh3DGeometry());
    return true;
  }

  const data = createGeometry(spec);
  const mesh = meshEntity.read(Mesh3D);
  if (mesh3DGeometryDataEquals(mesh, data)) {
    return false;
  }

  companionGeometry.set(source, { key });
  Object.assign(meshEntity.write(Mesh3D), data);
  meshEntity.write(Mesh3D).uvs = data.uvs ?? null;
  return true;
}

export function clearMesh3DNodeCompanionGeometryKey(source: Entity): void {
  companionGeometry.delete(source);
}

export function seedMesh3DNodeCompanionGeometryKey(
  source: Entity,
  material?: ImportedMaterial,
): void {
  if (!source.has(Mesh3DNode)) {
    return;
  }
  const spec = normalizeGeometry(source.read(Mesh3DNode).geometry);
  companionGeometry.set(source, { key: geometrySpecKey(spec), material });
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

  syncMesh3DNodeCompanionMaterial(source, meshEntity);
  return true;
}

/** Imported defaults remain runtime data, independent of document overrides. */
export function syncMesh3DNodeCompanionMaterial(
  source: Entity,
  meshEntity: Entity,
): void {
  const node = source.read(Mesh3DNode);
  const loaded = companionGeometry.get(source);
  const spec = normalizeGeometry(node.geometry);
  const imported =
    isGltfGeometrySpec(spec) && loaded?.key === geometrySpecKey(spec)
      ? loaded.material
      : undefined;
  const hasCustomColor = node.baseColor.some((value) => value !== 1);
  const material = meshEntity.write(Material3D);
  material.baseColor = [
    ...(hasCustomColor
      ? node.baseColor
      : imported?.baseColor ?? node.baseColor),
  ];
  material.ambient = node.ambient;
  material.diffuse = node.diffuse;
  material.specular = node.specular;
  material.shininess = node.shininess;
  material.metallic = node.metallic;
  material.roughness = node.roughness;
  material.map = node.map ?? imported?.map ?? null;
  material.specularMap = node.specularMap ?? null;
  material.bumpMap = node.bumpMap ?? null;
  material.bumpScale = node.bumpScale;
}

/** Convert the canvas-space companion center back to the source's local origin. */
export function resolveMesh3DNodeSourceTransform(
  source: Entity,
  pose: Pick<Transform3D, 'translation' | 'rotation' | 'scale'>,
) {
  if (!source.has(Mesh3DNode) || !source.has(Transform)) return;
  const { translation, rotation, scale } = pose;
  let inverseParent = mat3.create();
  if (source.has(Children)) {
    const parent = source.read(Children).parent;
    if (parent && !parent.has(Camera) && parent.has(GlobalTransform)) {
      const inverse = mat3.invert(
        mat3.create(),
        Mat3.toGLMat3(parent.read(GlobalTransform).matrix),
      );
      if (!inverse) return;
      inverseParent = inverse;
    }
  }
  const center = [
    inverseParent[0] * translation[0] +
      inverseParent[3] * translation[1] +
      inverseParent[6],
    inverseParent[1] * translation[0] +
      inverseParent[4] * translation[1] +
      inverseParent[7],
  ];
  const local = source.read(Transform);
  const rect = source.has(Rect) ? source.read(Rect) : undefined;
  const cx = ((rect?.width ?? 0) * local.scale.x) / 2;
  const cy = ((rect?.height ?? 0) * local.scale.y) / 2;
  const cos = Math.cos(local.rotation);
  const sin = Math.sin(local.rotation);
  const [sx, sy, sz] = scale;
  return {
    x: center[0] - (cx * cos - cy * sin),
    y: center[1] - (cx * sin + cy * cos),
    z: translation[2],
    rotation3d: [...rotation] as [number, number, number],
    scale3d:
      Math.abs(sx - sy) < 1e-4 && Math.abs(sy - sz) < 1e-4
        ? sx
        : ([...scale] as [number, number, number]),
  };
}

/** Sync declarative source from companion mesh (during gizmo drag). */
export function syncMesh3DNodeSourceFromCompanion(
  source: Entity,
  meshEntity: Entity,
): boolean {
  if (!meshEntity.has(Transform3D)) return false;
  const pose = resolveMesh3DNodeSourceTransform(
    source,
    meshEntity.read(Transform3D),
  );
  if (!pose) return false;
  const { x, y, ...node } = pose;
  Object.assign(source.write(Mesh3DNode), node);
  Object.assign(source.write(Transform).translation, { x, y });
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

export { normalizeGeometry } from './geometry3d';
