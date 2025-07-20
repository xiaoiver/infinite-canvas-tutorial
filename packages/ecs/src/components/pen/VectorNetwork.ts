/**
 * @see https://github.com/evanw/figma-fill-rule-editor
 */

import { Entity, field } from '@lastolivegames/becsy';
import { Polyline } from '../geometry';
import { SerializedNode, serializePoints } from '../../utils';

interface VectorVertex {
  x: number;
  y: number;
}

interface VectorSegment {
  start: number;
  end: number;
  tangentStart?: VectorVertex; // Defaults to { x: 0, y: 0 }
  tangentEnd?: VectorVertex; // Defaults to { x: 0, y: 0 }
}

interface VectorRegion {
  fillRule: CanvasFillRule;
  loops: ReadonlyArray<ReadonlyArray<number>>;
}

export class VectorNetwork {
  static toSerializedNode(
    network: VectorNetwork,
    node: SerializedNode,
  ): SerializedNode {
    if (node.type === 'polyline') {
      const { vertices, segments } = network;
      const points = vertices.map(({ x, y }) => [x, y] as [number, number]);
      node.points = serializePoints(points);
    }
    return node;
  }

  static fromEntity(entity: Entity): VectorNetwork {
    if (entity.has(Polyline)) {
      const { points } = entity.read(Polyline);
      const vertices: VectorVertex[] = points.map(([x, y]) => ({ x, y }));
      const segments: VectorSegment[] = points.slice(1).map((_, i) => ({
        start: i,
        end: i + 1,
      }));

      return { vertices, segments };
    }
  }

  @field.object declare vertices: VectorVertex[];
  @field.object declare segments: VectorSegment[];
  @field.object declare regions?: VectorRegion[]; // Defaults to []

  constructor(vectorNetwork?: Partial<VectorNetwork>) {
    Object.assign(this, vectorNetwork);
  }
}
