/**
 * @see https://github.com/evanw/figma-fill-rule-editor
 */

import { Entity, field } from '@lastolivegames/becsy';
import { Polyline } from './Polyline';
import {
  SerializedNode,
  serializePoints,
  VectorNetworkSerializedNode,
} from '../../utils';
import { AABB } from '../math';
import { Stroke } from '../renderable';

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
  static getGeometryBounds(
    vectorNetwork:
      | Partial<VectorNetwork>
      | Partial<VectorNetworkSerializedNode>,
  ) {
    let { vertices } = vectorNetwork;

    if (!vertices || vertices.length < 2) {
      return new AABB(0, 0, 0, 0);
    }

    const minX = Math.min(
      ...vertices.map(({ x }) => (isNaN(x) ? Infinity : x)),
    );
    const maxX = Math.max(
      ...vertices.map(({ x }) => (isNaN(x) ? -Infinity : x)),
    );
    const minY = Math.min(
      ...vertices.map(({ y }) => (isNaN(y) ? Infinity : y)),
    );
    const maxY = Math.max(
      ...vertices.map(({ y }) => (isNaN(y) ? -Infinity : y)),
    );

    return new AABB(minX, minY, maxX, maxY);
  }

  static getRenderBounds(vectorNetwork: VectorNetwork, stroke?: Stroke) {
    const { width, linecap } = stroke ?? {};

    let style_expansion = 0.5;
    if (linecap === 'square') {
      style_expansion = Math.SQRT1_2;
    }

    style_expansion *= width;

    const { minX, minY, maxX, maxY } =
      VectorNetwork.getGeometryBounds(vectorNetwork);
    return new AABB(
      minX - style_expansion,
      minY - style_expansion,
      maxX + style_expansion,
      maxY + style_expansion,
    );
  }

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
