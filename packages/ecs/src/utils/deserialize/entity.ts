import { isNil } from '@antv/util';
import toposort from 'toposort';
import { Entity } from '@lastolivegames/becsy';
import {
  Circle,
  Ellipse,
  FillSolid,
  FillGradient,
  Name,
  Opacity,
  Path,
  Polyline,
  Rect,
  Renderable,
  Stroke,
  Text,
  Transform,
  Visibility,
  DropShadow,
} from '../../components';
import {
  CircleSerializedNode,
  DropShadowAttributes,
  EllipseSerializedNode,
  FillAttributes,
  NameAttributes,
  PathSerializedNode,
  PolylineSerializedNode,
  RectSerializedNode,
  SerializedNode,
  StrokeAttributes,
  TextSerializedNode,
  VisibilityAttributes,
} from '../serialize';
import { deserializePoints } from './points';
import { EntityCommands } from '../../commands/EntityCommands';
import { isGradient } from '../gradient';
import { Commands } from '../../commands/Commands';

export function serializedNodesToEntities(
  nodes: SerializedNode[],
  commands: Commands,
): {
  entities: Entity[];
  idEntityMap: Map<string, EntityCommands>;
} {
  const vertices = nodes.map((node) => node.id);
  const edges = nodes
    .filter((node) => !isNil(node.parentId))
    .map((node) => [node.parentId, node.id] as [string, string]);
  const sorted = toposort.array(vertices, edges);

  const idEntityMap = new Map<string, EntityCommands>();
  const entities: Entity[] = [];
  for (const id of sorted) {
    const node = nodes.find((node) => node.id === id);
    const { parentId, type } = node;
    const attributes = node;

    const entity = commands.spawn();
    idEntityMap.set(id, entity);

    const { transform } = attributes;
    entity.insert(new Transform(transform));

    if (type !== 'g') {
      entity.insert(new Renderable());
    }

    if (type === 'circle') {
      const { cx, cy, r } = attributes as CircleSerializedNode;
      entity.insert(new Circle({ cx, cy, r }));
    } else if (type === 'ellipse') {
      const { cx, cy, rx, ry } = attributes as EllipseSerializedNode;
      entity.insert(new Ellipse({ cx, cy, rx, ry }));
    } else if (type === 'rect') {
      const { x, y, width, height, cornerRadius } =
        attributes as RectSerializedNode;
      entity.insert(new Rect({ x, y, width, height, cornerRadius }));
    } else if (type === 'polyline') {
      const { points } = attributes as PolylineSerializedNode;
      entity.insert(new Polyline({ points: deserializePoints(points) }));
    } else if (type === 'path') {
      const { d, fillRule, tessellationMethod } =
        attributes as PathSerializedNode;
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
      } = attributes as TextSerializedNode;
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
      if (isGradient(fill)) {
        entity.insert(new FillGradient(fill));
      } else {
        entity.insert(new FillSolid(fill));
      }
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
          // comma and/or white space separated
          dasharray: (strokeDasharray?.includes(',')
            ? strokeDasharray?.split(',')
            : strokeDasharray?.split(' ')
          )?.map(Number) as [number, number],
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

    const {
      dropShadowBlurRadius,
      dropShadowColor,
      dropShadowOffsetX,
      dropShadowOffsetY,
    } = attributes as DropShadowAttributes;
    if (dropShadowBlurRadius) {
      entity.insert(
        new DropShadow({
          color: dropShadowColor,
          blurRadius: dropShadowBlurRadius,
          offsetX: dropShadowOffsetX,
          offsetY: dropShadowOffsetY,
        }),
      );
    }

    const { visibility } = attributes as VisibilityAttributes;
    entity.insert(new Visibility(visibility));

    const { name } = attributes as NameAttributes;
    entity.insert(new Name(name));

    if (parentId) {
      idEntityMap.get(parentId)?.appendChild(entity);
    }

    entities.push(entity.id().hold());
  }

  return { entities, idEntityMap };
}
