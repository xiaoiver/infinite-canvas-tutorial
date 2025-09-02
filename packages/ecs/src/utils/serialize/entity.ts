import { Entity } from '@lastolivegames/becsy';
import {
  DropShadowAttributes,
  FillAttributes,
  InnerShadowAttributes,
  LineSerializedNode,
  MarkerAttributes,
  PathSerializedNode,
  PolylineSerializedNode,
  RectSerializedNode,
  SerializedNode,
  StrokeAttributes,
  TextDecorationAttributes,
  TextSerializedNode,
} from './type';
import {
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
  FractionalIndex,
  ComputedBounds,
  Camera,
  ComputedTextMetrics,
  TextDecoration,
  FillImage,
  FillPattern,
  Marker,
  InnerShadow,
  DropShadow,
  Line,
} from '../../components';
import { serializePoints } from './points';

export function isEntity(entity: any): entity is Entity {
  return entity.__id !== undefined;
}

export function entityToSerializedNodes(
  entity: Entity,
  filter?: (entity: Entity) => boolean,
): SerializedNode[] {
  if (filter && !filter(entity)) {
    return [];
  }

  const id = entity.__id;
  const parentId = entity.has(Children)
    ? entity.read(Children).parent.has(Camera)
      ? undefined
      : entity.read(Children).parent.__id
    : undefined;

  let type: SerializedNode['type'];
  const attributes: Partial<SerializedNode> = {};
  if (entity.has(Circle)) {
    type = 'ellipse';
  } else if (entity.has(Ellipse)) {
    type = 'ellipse';
  } else if (entity.has(Rect)) {
    type = 'rect';
    const { cornerRadius } = entity.read(Rect);
    (attributes as RectSerializedNode).cornerRadius = cornerRadius;
  } else if (entity.has(Line)) {
    type = 'line';
    const { x1, y1, x2, y2 } = entity.read(Line);
    (attributes as LineSerializedNode).x1 = x1;
    (attributes as LineSerializedNode).y1 = y1;
    (attributes as LineSerializedNode).x2 = x2;
    (attributes as LineSerializedNode).y2 = y2;
  } else if (entity.has(Polyline)) {
    type = 'polyline';
    const { points } = entity.read(Polyline);
    (attributes as PolylineSerializedNode).points = serializePoints(points);
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
    const { fontMetrics } = entity.read(ComputedTextMetrics);
    const {
      fontBoundingBoxAscent,
      fontBoundingBoxDescent,
      hangingBaseline,
      ideographicBaseline,
    } = fontMetrics;

    Object.assign(attributes as TextSerializedNode, {
      fontBoundingBoxAscent,
      fontBoundingBoxDescent,
      hangingBaseline,
      ideographicBaseline,
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

    if (entity.has(TextDecoration)) {
      const { color, line, style, thickness } = entity.read(TextDecoration);
      Object.assign(attributes as TextDecorationAttributes, {
        decorationColor: color,
        decorationLine: line,
        decorationStyle: style,
        decorationThickness: thickness,
      });
    }
  } else {
    type = 'g';
  }

  if (entity.has(FillSolid)) {
    (attributes as FillAttributes).fill = entity.read(FillSolid).value;
  } else if (entity.has(FillGradient)) {
    (attributes as FillAttributes).fill = entity.read(FillGradient).value;
  } else if (entity.has(FillImage)) {
    (attributes as FillAttributes).fill = entity.read(FillImage).url;
  } else if (entity.has(FillPattern)) {
    // TODO: serialize pattern
    // (attributes as FillAttributes).fill = entity.read(FillPattern).value;
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
      strokeDasharray: `${dasharray[0]},${dasharray[1]}`,
      strokeDashoffset: dashoffset,
    });
  }

  if (entity.has(Marker)) {
    const { start, end, factor } = entity.read(Marker);
    Object.assign(attributes as MarkerAttributes, {
      markerStart: start,
      markerEnd: end,
      markerFactor: factor,
    });
  }

  if (entity.has(Opacity)) {
    const { opacity, fillOpacity, strokeOpacity } = entity.read(Opacity);
    Object.assign(attributes, {
      opacity,
      fillOpacity,
      strokeOpacity,
    });
  }

  if (entity.has(InnerShadow)) {
    const { color, blurRadius, offsetX, offsetY } = entity.read(InnerShadow);
    Object.assign(attributes as InnerShadowAttributes, {
      innerShadowColor: color,
      innerShadowBlurRadius: blurRadius,
      innerShadowOffsetX: offsetX,
      innerShadowOffsetY: offsetY,
    });
  }

  if (entity.has(DropShadow)) {
    const { color, blurRadius, offsetX, offsetY } = entity.read(DropShadow);
    Object.assign(attributes as DropShadowAttributes, {
      dropShadowColor: color,
      dropShadowBlurRadius: blurRadius,
      dropShadowOffsetX: offsetX,
      dropShadowOffsetY: offsetY,
    });
  }

  // serialize transform
  if (entity.has(ComputedBounds)) {
    const {
      obb: { x, y, width, height, rotation, scaleX, scaleY },
    } = entity.read(ComputedBounds);
    attributes.x = x;
    attributes.y = y;
    attributes.width = width;
    attributes.height = height;
    attributes.rotation = rotation;
    attributes.scaleX = scaleX;
    attributes.scaleY = scaleY;
  }

  if (entity.has(Name)) {
    attributes.name = entity.read(Name).value;
  }

  // serialize visibility
  if (entity.has(Visibility)) {
    attributes.visibility = entity.read(Visibility).value;
  }

  if (entity.has(FractionalIndex)) {
    attributes.fractionalIndex = entity.read(FractionalIndex).value;
  }

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
    const children = entity
      .read(Parent)
      .children.map((e) => entityToSerializedNodes(e, filter));
    nodes.push(...children.flat(1));
  }

  return nodes;
}
