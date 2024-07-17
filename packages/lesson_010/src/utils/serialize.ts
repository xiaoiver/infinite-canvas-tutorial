import { Transform } from '@pixi/math';
import { Circle, Ellipse, Group, Rect, Shape } from '../shapes';

type SerializedTransform = {
  position: {
    x: number;
    y: number;
  };
  scale: {
    x: number;
    y: number;
  };
  skew: {
    x: number;
    y: number;
  };
  rotation: number;
  pivot: {
    x: number;
    y: number;
  };
};

const commonAttributes = ['renderable'] as const;
const renderableAttributes = [
  'visible',
  'cullable',
  'batchable',
  'fill',
  'stroke',
  'strokeWidth',
  'opacity',
  'fillOpacity',
  'strokeOpacity',
  'innerShadowColor',
  'innerShadowOffsetX',
  'innerShadowOffsetY',
  'innerShadowBlurRadius',
] as const;

const circleAttributes = ['cx', 'cy', 'r'] as const;
const ellipseAttributes = ['cx', 'cy', 'rx', 'ry'] as const;
const rectAttributes = [
  'x',
  'y',
  'width',
  'height',
  'cornerRadius',
  'dropShadowColor',
  'dropShadowOffsetX',
  'dropShadowOffsetY',
  'dropShadowBlurRadius',
] as const;

type CommonAttributeName = (typeof commonAttributes &
  typeof renderableAttributes)[number];
type CircleAttributeName = (typeof circleAttributes)[number];
type EllipseAttributeName = (typeof ellipseAttributes)[number];
type RectAttributeName = (typeof rectAttributes)[number];

interface SerializedNode {
  type: string;
  attributes?: Record<CommonAttributeName, Shape[CommonAttributeName]> &
    Record<'transform', SerializedTransform> &
    Partial<Record<CircleAttributeName, Circle[CircleAttributeName]>> &
    Partial<Record<EllipseAttributeName, Ellipse[EllipseAttributeName]>> &
    Partial<Record<RectAttributeName, Rect[RectAttributeName]>>;
  children?: SerializedNode[];
}

export function typeofShape(
  shape: Shape,
):
  | ['g', typeof commonAttributes]
  | ['circle', ...(typeof circleAttributes & typeof renderableAttributes)]
  | ['ellipse', ...(typeof ellipseAttributes & typeof renderableAttributes)]
  | ['rect', ...(typeof rectAttributes & typeof renderableAttributes)] {
  if (shape instanceof Group) {
    return ['g', commonAttributes];
  } else if (shape instanceof Circle) {
    return ['circle', [...renderableAttributes, ...circleAttributes]];
  } else if (shape instanceof Ellipse) {
    return ['ellipse', [...renderableAttributes, ...ellipseAttributes]];
  } else if (shape instanceof Rect) {
    return ['rect', [...renderableAttributes, ...rectAttributes]];
  }
}

export function deserializeNode(data: SerializedNode): Shape {
  const { type, attributes, children } = data;
  let shape: Shape;
  if (type === 'g') {
    shape = new Group();
  } else if (type === 'circle') {
    shape = new Circle();
  } else if (type === 'ellipse') {
    shape = new Ellipse();
  } else if (type === 'rect') {
    shape = new Rect();
  }

  const { transform, ...rest } = attributes;
  Object.assign(shape, rest);

  shape.transform.position.set(transform.position.x, transform.position.y);
  shape.transform.scale.set(transform.scale.x, transform.scale.y);
  shape.transform.skew.set(transform.skew.x, transform.skew.y);
  shape.transform.rotation = transform.rotation;
  shape.transform.pivot.set(transform.pivot.x, transform.pivot.y);

  if (children && children.length > 0) {
    shape.children = children.map(deserializeNode);
  }
  return shape;
}

export function serializeNode(node: Shape): SerializedNode {
  const [type, attributes] = typeofShape(node);
  const data: SerializedNode = {
    type,
    attributes: [...commonAttributes, ...attributes].reduce((prev, cur) => {
      prev[cur] = node[cur];
      return prev;
    }, {} as Record<CommonAttributeName, Shape[CommonAttributeName]> & Record<'transform', SerializedTransform>),
  };

  data.attributes.transform = serializeTransform(node.transform);
  data.children = node.children.map(serializeNode);

  return data;
}

export function serializeTransform(transform: Transform): SerializedTransform {
  return {
    position: {
      x: transform.position.x,
      y: transform.position.y,
    },
    scale: {
      x: transform.scale.x,
      y: transform.scale.y,
    },
    skew: {
      x: transform.skew.x,
      y: transform.skew.y,
    },
    rotation: transform.rotation,
    pivot: {
      x: transform.pivot.x,
      y: transform.pivot.y,
    },
  };
}
