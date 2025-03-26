import { Entity } from '@lastolivegames/becsy';
import {
  CircleSerializedNode,
  EllipseSerializedNode,
  FillAttributes,
  PathSerializedNode,
  PolylineSerializedNode,
  RectSerializedNode,
  SerializedNode,
  StrokeAttributes,
  TextSerializedNode,
} from './type';
import {
  Transform,
  Children,
  Circle,
  Ellipse,
  Path,
  Polyline,
  Rect,
  Text,
  Parent,
  FillSolid,
  FillGradient,
  Stroke,
  Opacity,
  Visibility,
  Name,
} from '../../components';
import { serializeTransform } from './transform';

export function entityToSerializedNodes(entity: Entity): SerializedNode[] {
  const id = entity.__id;
  const parentId = entity.has(Children)
    ? entity.read(Children).parent.__id
    : undefined;

  let type: SerializedNode['type'];
  let attributes: Partial<SerializedNode> = {};
  if (entity.has(Circle)) {
    type = 'circle';
    const { cx, cy, r } = entity.read(Circle);
    Object.assign(attributes as CircleSerializedNode, {
      cx,
      cy,
      r,
    });
  } else if (entity.has(Ellipse)) {
    type = 'ellipse';
    const { cx, cy, rx, ry } = entity.read(Ellipse);
    Object.assign(attributes as EllipseSerializedNode, {
      cx,
      cy,
      rx,
      ry,
    });
  } else if (entity.has(Rect)) {
    type = 'rect';
    const { x, y, width, height, cornerRadius } = entity.read(Rect);
    Object.assign(attributes as RectSerializedNode, {
      x,
      y,
      width,
      height,
      cornerRadius,
    });
  } else if (entity.has(Polyline)) {
    type = 'polyline';
    const { points } = entity.read(Polyline);
    Object.assign(attributes as PolylineSerializedNode, {
      points,
    });
  } else if (entity.has(Path)) {
    type = 'path';
    const { d, fillRule, tessellationMethod } = entity.read(Path);
    Object.assign(attributes as PathSerializedNode, {
      d,
      fillRule,
      tessellationMethod,
    });
  } else if (entity.has(Text)) {
    type = 'text';
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
      textOverflow,
      maxLines,
      textAlign,
      textBaseline,
      leading,
      bitmapFont,
      bitmapFontKerning,
      physical,
      esdt,
    } = entity.read(Text);
    Object.assign(attributes as TextSerializedNode, {
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
      textOverflow,
      maxLines,
      textAlign,
      textBaseline,
      leading,
      bitmapFont,
      bitmapFontKerning,
      physical,
      esdt,
    });
  } else {
    type = 'g';
  }

  if (entity.has(FillSolid)) {
    (attributes as FillAttributes).fill = entity.read(FillSolid).value;
  } else if (entity.has(FillGradient)) {
    // TODO: serialize gradient
  }

  if (entity.has(Stroke)) {
    const {
      color,
      width,
      alignment,
      linecap,
      linejoin,
      miterlimit,
      dasharray,
      dashoffset,
    } = entity.read(Stroke);
    Object.assign(attributes as StrokeAttributes, {
      stroke: color,
      strokeWidth: width,
      strokeAlignment: alignment,
      strokeLinecap: linecap,
      strokeLinejoin: linejoin,
      strokeMiterlimit: miterlimit,
      strokeDasharray: [dasharray[0], dasharray[1]],
      strokeDashoffset: dashoffset,
    });
  }

  if (entity.has(Opacity)) {
    const { opacity, fillOpacity, strokeOpacity } = entity.read(Opacity);
    Object.assign(attributes as CircleSerializedNode, {
      opacity,
      fillOpacity,
      strokeOpacity,
    });
  }

  // serialize transform
  if (entity.has(Transform)) {
    attributes.transform = serializeTransform(entity.read(Transform));
  }

  if (entity.has(Name)) {
    attributes.name = entity.read(Name).value;
  }

  // serialize visibility
  attributes.visibility = entity.has(Visibility)
    ? entity.read(Visibility).value
    : 'visible';

  // serialize children
  const nodes: SerializedNode[] = [
    {
      id: `${id}`,
      parentId: parentId ? `${parentId}` : undefined,
      type,
      ...attributes,
    } as SerializedNode,
  ];

  if (entity.has(Parent)) {
    const children = entity.read(Parent).children.map(entityToSerializedNodes);
    nodes.push(...children.flat(1));
  }

  return nodes;
}
