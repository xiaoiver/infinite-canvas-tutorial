import type { Entity } from '@lastolivegames/becsy';
import { Camera, Children, Rect, Transform } from '../../components';
import type { SerializedNode } from '../../types/serialized-node';
import { isEntityAlive } from '../Transform';

/** Local values avoid mistaking delayed world-matrix propagation for relayout. */
function layoutKey(source: Entity): string {
  const chain: unknown[] = [];
  const seen = new Set<number>();
  let entity: Entity | undefined = source;
  while (
    isEntityAlive(entity) &&
    !entity.has(Camera) &&
    !seen.has(entity.__id)
  ) {
    seen.add(entity.__id);
    const transform = entity.has(Transform)
      ? entity.read(Transform)
      : undefined;
    const rect = entity.has(Rect) ? entity.read(Rect) : undefined;
    chain.push([
      entity.__id,
      transform?.translation.x,
      transform?.translation.y,
      transform?.rotation,
      transform?.scale.x,
      transform?.scale.y,
      rect?.width,
      rect?.height,
    ]);
    entity = entity.has(Children) ? entity.read(Children).parent : undefined;
  }
  return JSON.stringify(chain);
}

/** Distinguish this gesture's writes from external, runtime-only layout changes. */
export class GizmoSourceFrame {
  private readonly origin: { x: number; y: number };
  private readonly documentOrigin?: { x: number; y: number };
  private previewOrigin: { x: number; y: number };
  private key: string;

  constructor(private readonly entity: Entity, node?: SerializedNode) {
    const { x, y } = entity.read(Transform).translation;
    this.origin = this.previewOrigin = { x, y };
    this.documentOrigin = node && { x: node.x ?? 0, y: node.y ?? 0 };
    this.key = layoutKey(entity);
  }

  current(): boolean {
    return this.key === layoutKey(this.entity);
  }

  acceptPreview(): void {
    const { x, y } = this.entity.read(Transform).translation;
    this.previewOrigin = { x, y };
    this.key = layoutKey(this.entity);
  }

  restoreOrigin(node?: SerializedNode): void {
    const { x, y } = this.entity.read(Transform).translation;
    const restored = { x, y };
    for (const axis of ['x', 'y'] as const) {
      // A newer document coordinate wins; otherwise roll back only values we
      // still own, to the computed origin captured before the first preview.
      if (node && (node[axis] ?? 0) !== this.documentOrigin?.[axis])
        restored[axis] = node[axis] ?? 0;
      else if (restored[axis] === this.previewOrigin[axis])
        restored[axis] = this.origin[axis];
    }
    Object.assign(this.entity.write(Transform).translation, restored);
  }
}
