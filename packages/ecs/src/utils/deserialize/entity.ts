import { isNil } from '@antv/util';
import toposort from 'toposort';
import {
  Circle,
  Commands,
  Ellipse,
  Entity,
  FillSolid,
  Opacity,
  Path,
  Polyline,
  Rect,
  Renderable,
  Stroke,
  Text,
  Transform,
  Visibility,
} from '../..';
import {
  FillAttributes,
  SerializedNode,
  StrokeAttributes,
  VisibilityAttributes,
} from '../serialize';
import { deserializePoints } from './points';
import { EntityCommands } from '../../commands/EntityCommands';

export function serializedNodesToEntities(
  nodes: SerializedNode[],
  commands: Commands,
): {
  entities: Entity[];
  idEntityMap: Map<number, EntityCommands>;
} {
  const vertices = nodes.map((node) => node.id);
  const edges = nodes
    .filter((node) => !isNil(node.parentId))
    .map((node) => [node.parentId, node.id] as [number, number]);
  const sorted = toposort.array(vertices, edges);

  const idEntityMap = new Map<number, EntityCommands>();
  const entities: Entity[] = [];
  for (const id of sorted) {
    const node = nodes.find((node) => node.id === id);
    const { parentId, type, attributes } = node;

    const entity = commands.spawn();
    idEntityMap.set(id, entity);

    const { transform } = attributes;
    entity.insert(new Transform(transform));

    if (type !== 'g') {
      entity.insert(new Renderable());
    }

    if (type === 'circle') {
      const { cx, cy, r } = attributes;
      entity.insert(new Circle({ cx, cy, r }));
    } else if (type === 'ellipse') {
      const { cx, cy, rx, ry } = attributes;
      entity.insert(new Ellipse({ cx, cy, rx, ry }));
    } else if (type === 'rect') {
      const { x, y, width, height, cornerRadius } = attributes;
      entity.insert(new Rect({ x, y, width, height, cornerRadius }));
    } else if (type === 'polyline') {
      const { points } = attributes;
      entity.insert(new Polyline({ points: deserializePoints(points) }));
    } else if (type === 'path') {
      const { d, fillRule, tessellationMethod } = attributes;
      entity.insert(new Path({ d, fillRule, tessellationMethod }));
    } else if (type === 'text') {
      const {
        x,
        y,
        content,
        fontFamily,
        fontSize,
        fontWeight,
        fontStyle,
        fontVariant,
        letterSpacing,
        lineHeight,
        whiteSpace,
        wordWrap,
        wordWrapWidth,
        textAlign,
        textBaseline,
      } = attributes;
      entity.insert(
        new Text({
          x,
          y,
          content,
          fontFamily,
          fontSize,
          fontWeight,
          fontStyle,
          fontVariant,
          letterSpacing,
          lineHeight,
          whiteSpace,
          wordWrap,
          wordWrapWidth,
          textAlign,
          textBaseline,
        }),
      );
    }

    const { fill, fillOpacity, opacity } = attributes as FillAttributes;
    if (fill) {
      entity.insert(new FillSolid(fill));
      // TODO: gradient, pattern, etc.
    }

    const {
      stroke,
      strokeWidth,
      strokeDasharray,
      strokeLinecap,
      strokeLinejoin,
      strokeMiterlimit,
      strokeOpacity,
      strokeDashoffset,
      strokeAlignment,
    } = attributes as StrokeAttributes;
    if (stroke) {
      entity.insert(
        new Stroke({
          color: stroke,
          width: strokeWidth,
          dasharray: strokeDasharray?.split(',').map(Number) as [
            number,
            number,
          ],
          linecap: strokeLinecap,
          linejoin: strokeLinejoin,
          miterlimit: strokeMiterlimit,
          dashoffset: strokeDashoffset,
          alignment: strokeAlignment,
        }),
      );
    }

    if (opacity || fillOpacity || strokeOpacity) {
      entity.insert(
        new Opacity({
          opacity,
          fillOpacity,
          strokeOpacity,
        }),
      );
    }

    const { visibility } = attributes as VisibilityAttributes;
    entity.insert(new Visibility(visibility));

    if (parentId) {
      idEntityMap.get(parentId)?.appendChild(entity);
    }

    entities.push(entity.id().hold());
  }

  return { entities, idEntityMap };
}
