import type { Entity } from '@lastolivegames/becsy';
import { Binded, Binding, Line, Path, Polyline } from '../../components';
import type { API } from '../../API';
import type { EdgeSerializedNode, SerializedNode } from '../../types/serialized-node';
import { safeAddComponent, safeRemoveComponent } from '../../history/ElementsChange';
import {
  inferPointsWithFromIdAndToId,
  inferXYWidthHeight,
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

  const edge = node as EdgeSerializedNode;
  if (!edge.fromId || !edge.toId) {
    return;
  }

  const fromNode = api.getNodeById(edge.fromId);
  const toNode = api.getNodeById(edge.toId);
  if (!fromNode || !toNode) {
    return;
  }

  const fromEntity = api.getEntity(fromNode);
  const toEntity = api.getEntity(toNode);
  safeAddComponent(fromEntity, Binded);
  safeAddComponent(toEntity, Binded);
  safeAddComponent(entity, Binding, {
    from: fromEntity,
    to: toEntity,
  });

  inferPointsWithFromIdAndToId(fromNode, toNode, node as EdgeState);
  inferXYWidthHeight(node);

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
