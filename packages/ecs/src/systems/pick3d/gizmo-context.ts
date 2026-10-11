import type { Entity } from '@lastolivegames/becsy';
import type { API } from '../../API';
import type { Mesh3DPickScene } from '../../utils/ray-casting';
import { extrude3DFromWire } from '../../utils/extrude3d';

/** Only spatial document changes interrupt a preview; names/materials may merge. */
export function gizmoDocumentKey(api: API, source: Entity): string {
  let node = api.getNodeByEntity(source);
  const chain: unknown[] = [];
  const seen = new Set<string>();
  while (node && !seen.has(node.id)) {
    seen.add(node.id);
    chain.push([
      node.id,
      node.type,
      node.parentId,
      node.x ?? 0,
      node.y ?? 0,
      node.width,
      node.height,
      node.rotation ?? 0,
      node.scaleX ?? 1,
      node.scaleY ?? 1,
      ...(node.type === 'mesh3d'
        ? [
            node.z ?? 0,
            node.rotation3d ?? [0, 0, 0],
            node.scale3d ?? 100,
            node.geometry,
          ]
        : node.type === 'rect'
        ? [extrude3DFromWire(node.extrude3d)]
        : []),
    ]);
    node = node.parentId ? api.getNodeById(node.parentId) : undefined;
  }
  return JSON.stringify(chain);
}

/** Compare the actual projection used to pick/render, including linked 2D views. */
export function gizmoViewKey(
  scene: Mesh3DPickScene,
  width: number,
  height: number,
): string {
  return JSON.stringify([
    width,
    height,
    scene.mode,
    ...scene.projMatrix,
    ...scene.viewMatrix,
    ...(scene.mode === 'linkedPerspective' ? scene.canvasViewProjection : []),
  ]);
}
