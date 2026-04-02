import type { Entity } from '@lastolivegames/becsy';
import { Binded, Binding, Line, PartialBinding, Path, Polyline, Transform } from '../../components';
import type { API } from '../../API';
import type { EdgeSerializedNode, SerializedNode } from '../../types/serialized-node';
import { safeAddComponent, safeRemoveComponent } from '../../history/ElementsChange';
import {
  edgeEndsResolvable,
  inferEdgePoints,
  inferEdgePointsPreservingBezierHandles,
  inferXYWidthHeight,
  type EdgePathPreserveSnapshot,
} from '../deserialize/entity';
import { deserializePoints } from '../deserialize/points';
import type { EdgeState } from '../binding';

function isEdgeType(type: string | undefined): boolean {
  return (
    type === 'line' ||
    type === 'rough-line' ||
    type === 'polyline' ||
    type === 'rough-polyline' ||
    type === 'path' ||
    type === 'rough-path'
  );
}

/**
 * Keep ECS {@link Binding}/{@link Binded} and stroke geometry in sync when `fromId`/`toId` change at runtime.
 */
export function syncEdgeBindingForEntity(
  api: API,
  entity: Entity,
  node: SerializedNode,
): void {
  if (!isEdgeType(node.type)) {
    return;
  }

  if (entity.has(Binding)) {
    safeRemoveComponent(entity, Binding);
  }
  if (entity.has(PartialBinding)) {
    safeRemoveComponent(entity, PartialBinding);
  }

  const edge = node as EdgeSerializedNode;
  const fromNode = edge.fromId ? api.getNodeById(edge.fromId) : undefined;
  const toNode = edge.toId ? api.getNodeById(edge.toId) : undefined;

  if (!edgeEndsResolvable(edge, fromNode, toNode)) {
    return;
  }

  if (edge.fromId && edge.toId && fromNode && toNode) {
    const fromEntity = api.getEntity(fromNode);
    const toEntity = api.getEntity(toNode);
    safeAddComponent(fromEntity, Binded);
    safeAddComponent(toEntity, Binded);
    safeAddComponent(entity, Binding, {
      from: fromEntity,
      to: toEntity,
    });
  } else if (fromNode && !toNode) {
    const fromEntity = api.getEntity(fromNode);
    safeAddComponent(fromEntity, Binded);
    safeAddComponent(entity, PartialBinding, {
      attached: fromEntity,
      sourceIsAttached: 1,
    });
  } else if (toNode && !fromNode) {
    const toEntity = api.getEntity(toNode);
    safeAddComponent(toEntity, Binded);
    safeAddComponent(entity, PartialBinding, {
      attached: toEntity,
      sourceIsAttached: 0,
    });
  }

  let pathPreserve: EdgePathPreserveSnapshot | undefined;
  if (node.type === 'path' || node.type === 'rough-path') {
    const pe = node as EdgeSerializedNode & {
      d?: string;
      x?: number;
      y?: number;
      rotation?: number;
      scaleX?: number;
      scaleY?: number;
    };
    if (pe.d) {
      pathPreserve = {
        d: pe.d,
        x: pe.x ?? 0,
        y: pe.y ?? 0,
        rotation: pe.rotation ?? 0,
        scaleX: pe.scaleX ?? 1,
        scaleY: pe.scaleY ?? 1,
      };
    }
  }

  delete (node as EdgeSerializedNode & { x?: number }).x;
  delete (node as EdgeSerializedNode & { y?: number }).y;
  delete (node as EdgeSerializedNode & { width?: number }).width;
  delete (node as EdgeSerializedNode & { height?: number }).height;

  const preserved =
    pathPreserve != null &&
    inferEdgePointsPreservingBezierHandles(
      fromNode ?? null,
      toNode ?? null,
      node as EdgeState,
      pathPreserve,
    );
  if (!preserved) {
    inferEdgePoints(fromNode ?? null, toNode ?? null, node as EdgeState);
  }
  inferXYWidthHeight(node);

  // Keep ECS transform aligned with newly inferred edge local geometry.
  if (typeof node.x === 'number') {
    entity.write(Transform).translation.x = node.x;
  }
  if (typeof node.y === 'number') {
    entity.write(Transform).translation.y = node.y;
  }

  if (node.type === 'line' || node.type === 'rough-line') {
    const l = node as EdgeSerializedNode & {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    };
    entity.write(Line).x1 = l.x1;
    entity.write(Line).y1 = l.y1;
    entity.write(Line).x2 = l.x2;
    entity.write(Line).y2 = l.y2;
  } else if (node.type === 'polyline' || node.type === 'rough-polyline') {
    const { points } = node as EdgeSerializedNode & { points: string };
    entity.write(Polyline).points = deserializePoints(points);
  } else if (node.type === 'path' || node.type === 'rough-path') {
    const { d } = node as EdgeSerializedNode & { d: string };
    entity.write(Path).d = d;
  }
}
