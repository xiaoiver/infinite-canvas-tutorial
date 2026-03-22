import { isNil, path2Absolute } from '@antv/util';
import toposort from 'toposort';
import { Entity } from '@lastolivegames/becsy';
import { IPointData } from '@pixi/math';
import {
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
  ZIndex,
  Font,
  AABB,
  TextDecoration,
  FillImage,
  FillPattern,
  MaterialDirty,
  SizeAttenuation,
  StrokeAttenuation,
  Brush,
  Wireframe,
  Rough,
  VectorNetwork,
  Marker,
  InnerShadow,
  Line,
  LockAspectRatio,
  HTML,
  HTMLContainer,
  Embed,
  Filter,
  Binding,
  Binded,
  EdgeLabel,
  Locked,
  ClipMode,
  Flex,
} from '../../components';
import type {
  AttenuationAttributes,
  BrushSerializedNode,
  DropShadowAttributes,
  EdgeSerializedNode,
  EmbedSerializedNode,
  FillAttributes,
  FilterAttributes,
  HtmlSerializedNode,
  InnerShadowAttributes,
  LineSerializedNode,
  MarkerAttributes,
  NameAttributes,
  NodeSerializedNode,
  PathSerializedNode,
  PolylineSerializedNode,
  RectSerializedNode,
  RoughAttributes,
  SerializedNode,
  TextSerializedNode,
  VectorNetworkSerializedNode,
  StrokeAttributes,
  VisibilityAttributes,
  WireframeAttributes,
  FlexboxLayoutAttributes,
} from '../../types/serialized-node';
import {
  isDataUrl,
  isUrl,
  serializePoints,
  shiftPath,
  serializeBrushPoints,
} from '../serialize';
import { formatNumber } from '../serialize/points';
import { deserializeBrushPoints, deserializePoints } from './points';
import { EntityCommands, Commands } from '../../commands';
import { isGradient } from '../gradient';
import { isPattern } from '../pattern';
import { computeBidi, measureText } from '../../systems/ComputeTextMetrics';
import { DOMAdapter } from '../../environment';
import { safeAddComponent } from '../../history';
import { EdgeState, updateFixedTerminalPoints, updateFloatingTerminalPoints, updatePoints } from '../binding';
import { pointAlongPolylineByT } from '../polyline-arclength';
import simplify from 'simplify-js';

export function inferXYWidthHeight(node: SerializedNode) {
  if (node.type === 'g') {
    return node;
  }

  if (
    isNil(node.width) ||
    isNil(node.height) ||
    isNil(node.x) ||
    isNil(node.y)
  ) {
    const { type } = node;
    let bounds: AABB;
    if (type === 'rect' || type === 'html' || type === 'embed') {
      bounds = Rect.getGeometryBounds(node as Partial<Rect>);
    } else if (type === 'ellipse' || type === 'rough-ellipse') {
      bounds = Ellipse.getGeometryBounds(node);
    } else if (type === 'polyline' || type === 'rough-polyline') {
      bounds = Polyline.getGeometryBounds(node);
    } else if (type === 'line' || type === 'rough-line') {
      bounds = Line.getGeometryBounds(node);
    } else if (type === 'path' || type === 'rough-path') {
      bounds = Path.getGeometryBounds(node);
    } else if (type === 'text') {
      computeBidi(node.content);
      const metrics = measureText(node);
      bounds = Text.getGeometryBounds(node, metrics);
    } else if (type === 'brush') {
      bounds = Brush.getGeometryBounds(node);
    } else if (type === 'vector-network') {
      bounds = VectorNetwork.getGeometryBounds(node);
    }

    if (bounds) {
      node.x = bounds.minX;
      node.y = bounds.minY;
      node.width = bounds.maxX - bounds.minX;
      node.height = bounds.maxY - bounds.minY;

      if (type === 'polyline' || type === 'rough-polyline') {
        node.points = serializePoints(
          deserializePoints(node.points).map((point) => {
            return [point[0] - bounds.minX, point[1] - bounds.minY];
          }),
        );
      } else if (type === 'line' || type === 'rough-line') {
        node.x1 = node.x1 - bounds.minX;
        node.y1 = node.y1 - bounds.minY;
        node.x2 = node.x2 - bounds.minX;
        node.y2 = node.y2 - bounds.minY;
      } else if (type === 'path' || type === 'rough-path') {
        node.d = shiftPath(node.d, -bounds.minX, -bounds.minY);
      } else if (type === 'brush') {
        node.points = serializeBrushPoints(
          deserializeBrushPoints(node.points).map((point) => {
            return {
              ...point,
              x: point.x - bounds.minX,
              y: point.y - bounds.minY,
            };
          }),
        );
      } else if (type === 'text') {
        node.anchorX = (node.anchorX ?? 0) - bounds.minX;
        node.anchorY = (node.anchorY ?? 0) - bounds.minY;
      }
    } else {
      throw new Error('Cannot infer x, y, width or height for node');
    }

    return node;
  }
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * 与 draw.io {@link https://github.com/jgraph/drawio/blob/dev/src/main/webapp/mxgraph/src/shape/mxShape.js#L1230-L1321 mxShape.prototype.addPoints}
 * 一致：将折线顶点转为 SVG `d`（开放路径，无 close）。圆角段用二次贝塞尔 Q，控制点为角点。
 */
function addOpenPointsToPathD(pts: IPointData[], rounded: boolean, arcSize: number): string {
  if (pts.length === 0) {
    return '';
  }
  const close = false;
  const initialMove = true;
  const exclude: number[] | null = null;

  const points = pts;
  const pe = points[points.length - 1];

  const parts: string[] = [];
  let pt = points[0];
  let i = 1;

  const moveTo = (x: number, y: number) => {
    parts.push(`M ${formatNumber(x)} ${formatNumber(y)}`);
  };
  const lineTo = (x: number, y: number) => {
    parts.push(`L ${formatNumber(x)} ${formatNumber(y)}`);
  };
  const quadTo = (cx: number, cy: number, x: number, y: number) => {
    parts.push(
      `Q ${formatNumber(cx)} ${formatNumber(cy)} ${formatNumber(x)} ${formatNumber(y)}`,
    );
  };

  if (initialMove) {
    moveTo(pt.x, pt.y);
  } else {
    lineTo(pt.x, pt.y);
  }

  while (i < (close ? points.length : points.length - 1)) {
    let tmp = points[mod(i, points.length)];
    let dx = pt.x - tmp.x;
    let dy = pt.y - tmp.y;

    if (
      rounded &&
      (dx !== 0 || dy !== 0) &&
      (exclude == null || exclude.indexOf(i - 1) < 0)
    ) {
      let dist = Math.sqrt(dx * dx + dy * dy);
      const nx1 = (dx * Math.min(arcSize, dist / 2)) / dist;
      const ny1 = (dy * Math.min(arcSize, dist / 2)) / dist;

      const x1 = tmp.x + nx1;
      const y1 = tmp.y + ny1;
      lineTo(x1, y1);

      let next = points[mod(i + 1, points.length)];

      while (
        i < points.length - 2 &&
        Math.round(next.x - tmp.x) === 0 &&
        Math.round(next.y - tmp.y) === 0
      ) {
        next = points[mod(i + 2, points.length)];
        i++;
      }

      dx = next.x - tmp.x;
      dy = next.y - tmp.y;

      dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const nx2 = (dx * Math.min(arcSize, dist / 2)) / dist;
      const ny2 = (dy * Math.min(arcSize, dist / 2)) / dist;

      const x2 = tmp.x + nx2;
      const y2 = tmp.y + ny2;

      quadTo(tmp.x, tmp.y, x2, y2);
      tmp = { x: x2, y: y2 };
    } else {
      lineTo(tmp.x, tmp.y);
    }

    pt = tmp;
    i++;
  }

  if (!close) {
    lineTo(pe.x, pe.y);
  }

  return parts.join(' ');
}

/** 用路径命令端点折线近似 `d`，供边标签沿路径插值（曲线段为弦近似）。 */
export function polylineVertexApproxFromPathD(d: string | undefined): [number, number][] | null {
  if (!d) {
    return null;
  }
  const cmds = path2Absolute(d) as [string, ...number[]][];
  const pts: [number, number][] = [];
  for (const row of cmds) {
    const [command, ...data] = row;
    if (command === 'M' || command === 'L') {
      pts.push([data[0], data[1]]);
    } else if (command === 'Q') {
      pts.push([data[2], data[3]]);
    } else if (command === 'C') {
      pts.push([data[4], data[5]]);
    }
  }
  return pts.length >= 2 ? pts : null;
}

export function inferPointsWithFromIdAndToId(
  from: SerializedNode,
  to: SerializedNode,
  edge: EdgeState,
) {
  inferXYWidthHeight(from);
  inferXYWidthHeight(to);

  type NodeWithBounds = SerializedNode & { width: number; height: number; x: number; y: number };
  const state = edge as PolylineSerializedNode & { width: number; height: number; x: number; y: number } & { absolutePoints: (IPointData | null)[] };
  state.absolutePoints = [null, null];
  updateFixedTerminalPoints(state, from as NodeWithBounds, to as NodeWithBounds);
  updatePoints(state, null, from as NodeSerializedNode, to as NodeSerializedNode);
  updateFloatingTerminalPoints(state, from as NodeWithBounds, to as NodeWithBounds);

  state.absolutePoints = simplify(state.absolutePoints);

  if (edge.type === 'line' || edge.type === 'rough-line') {
    edge.x1 = state.absolutePoints[0].x;
    edge.y1 = state.absolutePoints[0].y;
    edge.x2 = state.absolutePoints[1].x;
    edge.y2 = state.absolutePoints[1].y;
  } else if (edge.type === 'polyline' || edge.type === 'rough-polyline') {
    edge.points = serializePoints(state.absolutePoints.map((point) => {
      return [point.x, point.y];
    }));
  } else if (edge.type === 'path' || edge.type === 'rough-path') {
    if (edge.bezier) {
      // this.paintBezierLine(c, pts);
    } else if (edge.curved) {
      // this.paintCurvedLine(c, pts);
    } else {
      const pts = state.absolutePoints.filter((p): p is IPointData => p != null);
      if (pts.length >= 2) {
        const arcSize =
          typeof (edge as EdgeState & { arcSize?: number }).arcSize === 'number'
            ? (edge as EdgeState & { arcSize: number }).arcSize
            : 10;
        if (edge.rounded) {
          (edge as PathSerializedNode).d = addOpenPointsToPathD(pts, true, arcSize);
        } else {
          (edge as PathSerializedNode).d =
            `M ${formatNumber(pts[0].x)} ${formatNumber(pts[0].y)} ` +
            pts
              .slice(1)
              .map((p) => `L ${formatNumber(p.x)} ${formatNumber(p.y)}`)
              .join(' ');
        }
      }
    }
  }
  delete state.absolutePoints;
}

/**
 * After bound edge geometry is finalized ({@link inferXYWidthHeight}), place child `text` nodes
 * with `edgeLabelPosition` on the edge in parent-local coordinates (same rules as {@link layoutTextAnchoredInParent}).
 */
function layoutSerializedEdgeLabelChildren(
  edge: SerializedNode,
  nodes: SerializedNode[],
) {
  const edgeId = edge.id;
  if (!edgeId) {
    return;
  }
  const labelNodes = nodes.filter(
    (n): n is TextSerializedNode =>
      n.type === 'text' &&
      n.parentId === edgeId &&
      (n as TextSerializedNode).edgeLabelPosition != null &&
      !Number.isNaN((n as TextSerializedNode).edgeLabelPosition!),
  );
  if (labelNodes.length === 0) {
    return;
  }

  let points: [number, number][] | null = null;
  if (edge.type === 'polyline' || edge.type === 'rough-polyline') {
    points = deserializePoints((edge as PolylineSerializedNode).points) as [
      number,
      number,
    ][];
  } else if (edge.type === 'line' || edge.type === 'rough-line') {
    const l = edge as LineSerializedNode;
    points = [
      [l.x1, l.y1],
      [l.x2, l.y2],
    ];
  } else if (edge.type === 'path' || edge.type === 'rough-path') {
    points = polylineVertexApproxFromPathD((edge as PathSerializedNode).d);
  }
  if (!points || points.length < 2) {
    return;
  }

  for (const labelNode of labelNodes) {
    const t = labelNode.edgeLabelPosition ?? 0.5;
    const [ax, ay] = pointAlongPolylineByT(points, t);
    const copy = {
      ...labelNode,
      anchorX: ax,
      anchorY: ay,
    };
    delete (copy as Partial<TextSerializedNode>).x;
    delete (copy as Partial<TextSerializedNode>).y;
    delete (copy as Partial<TextSerializedNode>).width;
    delete (copy as Partial<TextSerializedNode>).height;
    computeBidi(copy.content);
    inferXYWidthHeight(copy as SerializedNode);
    Object.assign(labelNode, {
      x: copy.x,
      y: copy.y,
      width: copy.width,
      height: copy.height,
      anchorX: copy.anchorX,
      anchorY: copy.anchorY,
    });
  }
}

export async function loadImage(url: string, entity: Entity) {
  const image = await DOMAdapter.get().createImage(url);
  safeAddComponent(entity, FillImage, {
    src: image as ImageBitmap,
    url,
  });
  safeAddComponent(entity, MaterialDirty);
}

function serializeRough(attributes: RoughAttributes, entity: EntityCommands) {
  const {
    roughRoughness,
    roughBowing,
    roughFillStyle,
    roughFillWeight,
    roughHachureAngle,
    roughHachureGap,
    roughCurveStepCount,
    roughCurveFitting,
    roughFillLineDash,
    roughFillLineDashOffset,
    roughDisableMultiStroke,
    roughDisableMultiStrokeFill,
    roughSimplification,
    roughDashOffset,
    roughDashGap,
    roughZigzagOffset,
    roughPreserveVertices,
  } = attributes;
  entity.insert(
    new Rough({
      roughness: roughRoughness,
      bowing: roughBowing,
      fillStyle: roughFillStyle,
      fillWeight: roughFillWeight,
      hachureAngle: roughHachureAngle,
      hachureGap: roughHachureGap,
      curveStepCount: roughCurveStepCount,
      curveFitting: roughCurveFitting,
      fillLineDash: roughFillLineDash,
      fillLineDashOffset: roughFillLineDashOffset,
      disableMultiStroke: roughDisableMultiStroke,
      disableMultiStrokeFill: roughDisableMultiStrokeFill,
      simplification: roughSimplification,
      dashOffset: roughDashOffset,
      dashGap: roughDashGap,
      zigzagOffset: roughZigzagOffset,
      preserveVertices: roughPreserveVertices,
    }),
  );
}

export function serializedNodesToEntities(
  nodes: SerializedNode[],
  fonts: Entity[],
  commands: Commands,
  idEntityMap?: Map<string, EntityCommands>,
): {
  entities: Entity[];
  idEntityMap: Map<string, EntityCommands>;
} {
  // The old entities are already added to canvas.
  let existedVertices: string[] = [];
  if (idEntityMap) {
    existedVertices = Array.from(idEntityMap.keys());
  }

  const vertices = Array.from(
    new Set([...existedVertices, ...nodes.map((node) => node.id)]),
  );
  const edges = nodes
    .filter((node) => !isNil(node.parentId))
    .map((node) => [node.parentId, node.id] as [string, string]);

  // bindings should also be sorted
  nodes.forEach((node) => {
    if (
      node.type === 'line' ||
      node.type === 'polyline' ||
      node.type === 'path' ||
      node.type === 'rough-line' ||
      node.type === 'rough-polyline' ||
      node.type === 'rough-path'
    ) {
      const { fromId, toId } = node as EdgeSerializedNode;
      if (fromId && toId) {
        edges.push([fromId, node.id]);
        edges.push([toId, node.id]);
      }
    }
  });

  const sorted = toposort.array(vertices, edges);

  if (!idEntityMap) {
    idEntityMap = new Map<string, EntityCommands>();
  }

  const entities: Entity[] = [];
  for (const id of sorted) {
    const node = nodes.find((node) => node.id === id);

    if (!node) {
      continue;
    }

    const attributes = node;
    if (!attributes.type) {
      attributes.type = 'rect';
    }

    const { parentId, type } = node;

    const entityCommands = commands.spawn();
    idEntityMap.set(id, entityCommands);

    // Infer points with fromId and toId first
    if (
      type === 'line' ||
      type === 'rough-line' ||
      type === 'polyline' ||
      type === 'rough-polyline' ||
      type === 'path' ||
      type === 'rough-path'
    ) {
      const { fromId, toId } = attributes as EdgeSerializedNode;
      if (fromId && toId) {
        const fromNode = nodes.find((node) => node.id === fromId);
        const toNode = nodes.find((node) => node.id === toId);
        if (fromNode && toNode) {
          inferPointsWithFromIdAndToId(
            fromNode,
            toNode,
            attributes as EdgeState,
          );
        }

        const fromEntityCommands = idEntityMap.get(fromId);
        const fromEntity = fromEntityCommands?.id().hold();
        const toEntityCommands = idEntityMap.get(toId);
        const toEntity = toEntityCommands?.id().hold();

        safeAddComponent(fromEntity, Binded);
        safeAddComponent(toEntity, Binded);
        entityCommands.insert(
          new Binding({
            from: fromEntity,
            to: toEntity,
          }),
        );
      }
    }

    // Make sure the entity has a width and height
    inferXYWidthHeight(attributes);

    const edgeAttrs = attributes as EdgeSerializedNode;
    if (
      (type === 'line' ||
        type === 'rough-line' ||
        type === 'polyline' ||
        type === 'rough-polyline' ||
        type === 'path' ||
        type === 'rough-path') &&
      edgeAttrs.fromId &&
      edgeAttrs.toId
    ) {
      layoutSerializedEdgeLabelChildren(attributes, nodes);
    }

    const { x, y, width, height, rotation = 0, scaleX = 1, scaleY = 1 } = attributes;
    const absoluteX = x ?? 0;
    const absoluteY = y ?? 0;
    const absoluteWidth = width ?? 0;
    const absoluteHeight = height ?? 0;

    entityCommands.insert(
      new Transform({
        translation: {
          x: absoluteX,
          y: absoluteY,
        },
        rotation,
        scale: {
          x: scaleX,
          y: scaleY,
        },
      }),
    );

    if (type !== 'g') {
      entityCommands.insert(new Renderable());
    }

    if (type === 'ellipse' || type === 'rough-ellipse') {
      entityCommands.insert(
        new Ellipse({
          cx: absoluteWidth / 2,
          cy: absoluteHeight / 2,
          rx: absoluteWidth / 2,
          ry: absoluteHeight / 2,
        }),
      );

      if (type === 'rough-ellipse') {
        serializeRough(attributes as RoughAttributes, entityCommands);
      }
    } else if (type === 'rect' || type === 'rough-rect') {
      const { cornerRadius } = attributes as RectSerializedNode;
      entityCommands.insert(
        new Rect({ x: 0, y: 0, width: absoluteWidth, height: absoluteHeight, cornerRadius }),
      );
      if (type === 'rough-rect') {
        serializeRough(attributes as RoughAttributes, entityCommands);
      }
    } else if (type === 'polyline' || type === 'rough-polyline') {
      const { points } = attributes as PolylineSerializedNode;
      entityCommands.insert(
        new Polyline({ points: deserializePoints(points) }),
      );
      if (type === 'rough-polyline') {
        serializeRough(attributes as RoughAttributes, entityCommands);
      }
    } else if (type === 'line' || type === 'rough-line') {
      const { x1, y1, x2, y2 } = attributes as LineSerializedNode;
      entityCommands.insert(new Line({ x1, y1, x2, y2 }));
      if (type === 'rough-line') {
        serializeRough(attributes as RoughAttributes, entityCommands);
      }
    } else if (type === 'brush') {
      const {
        points,
        brushType,
        brushStamp,
        stampInterval,
        stampMode,
        stampNoiseFactor,
        stampRotationFactor,
      } = attributes as BrushSerializedNode;
      entityCommands.insert(
        new Brush({
          points: deserializeBrushPoints(points),
          type: brushType,
          stampInterval,
          stampMode,
          stampNoiseFactor,
          stampRotationFactor,
        }),
      );

      if (brushStamp) {
        loadImage(brushStamp, entityCommands.id());
      }
    } else if (type === 'path' || type === 'rough-path') {
      const { d, fillRule, tessellationMethod } =
        attributes as PathSerializedNode;
      entityCommands.insert(new Path({ d, fillRule, tessellationMethod }));
      if (type === 'rough-path') {
        serializeRough(attributes as RoughAttributes, entityCommands);
      }
    } else if (type === 'text') {
      const {
        anchorX,
        anchorY,
        content,
        fontFamily,
        fontSize,
        fontWeight = 'normal',
        fontStyle = 'normal',
        fontVariant = 'normal',
        fontKerning = true,
        letterSpacing = 0,
        lineHeight = 0,
        whiteSpace = 'normal',
        wordWrap = false,
        wordWrapWidth,
        maxLines,
        textAlign = 'start',
        textBaseline = 'alphabetic',
        decorationThickness = 0,
        decorationColor = 'black',
        decorationLine = 'none',
        decorationStyle = 'solid',
        // fontBoundingBoxAscent = 0,
        // fontBoundingBoxDescent = 0,
        // hangingBaseline = 0,
        // ideographicBaseline = 0,
        edgeLabelPosition,
      } = attributes as TextSerializedNode;

      // let anchorX = 0;
      // let anchorY = 0;
      // if (textAlign === 'center') {
      //   anchorX = width / 2;
      // } else if (textAlign === 'right' || textAlign === 'end') {
      //   anchorX = width;
      // }

      // if (textBaseline === 'middle') {
      //   anchorY = height / 2;
      // } else if (textBaseline === 'alphabetic' || textBaseline === 'hanging') {
      //   anchorY = height;
      // }

      const bitmapFonts = fonts.map((font) => font.read(Font).bitmapFont);
      const bitmapFont = bitmapFonts.find(
        (font) => font.fontFamily === fontFamily,
      );

      entityCommands.insert(
        new Text({
          anchorX,
          anchorY,
          content,
          fontFamily,
          fontSize,
          fontWeight,
          fontStyle,
          fontVariant,
          fontKerning,
          letterSpacing,
          lineHeight,
          whiteSpace,
          wordWrap,
          wordWrapWidth,
          maxLines,
          textAlign,
          textBaseline,
          bitmapFont,
        }),
      );

      if (decorationLine !== 'none' && decorationThickness > 0) {
        entityCommands.insert(
          new TextDecoration({
            color: decorationColor,
            line: decorationLine,
            style: decorationStyle,
            thickness: decorationThickness,
          }),
        );
      }

      if (
        edgeLabelPosition != null &&
        !Number.isNaN(edgeLabelPosition)
      ) {
        entityCommands.insert(
          new EdgeLabel({ labelPosition: edgeLabelPosition }),
        );
      }
    } else if (type === 'vector-network') {
      const { vertices, segments, regions } =
        attributes as VectorNetworkSerializedNode;
      entityCommands.insert(new VectorNetwork({ vertices, segments, regions }));
    } else if (type === 'html') {
      const { html } = attributes as HtmlSerializedNode;
      entityCommands.insert(new HTML({ x: 0, y: 0, width: absoluteWidth, height: absoluteHeight, html }));
      entityCommands.insert(new HTMLContainer());
    } else if (type === 'embed') {
      const { url } = attributes as EmbedSerializedNode;
      entityCommands.insert(new Embed({ x: 0, y: 0, width: absoluteWidth, height: absoluteHeight, url }));
      entityCommands.insert(new HTMLContainer());
    }

    if (attributes.clipMode) {
      entityCommands.insert(new ClipMode(attributes.clipMode));
    }

    const { fill, fillOpacity, opacity } = attributes as FillAttributes;
    if (fill) {
      if (isGradient(fill)) {
        entityCommands.insert(new FillGradient(fill));
      } else if (isDataUrl(fill) || isUrl(fill)) {
        loadImage(fill, entityCommands.id());
      } else {
        try {
          const parsed = JSON.parse(fill) as FillPattern;
          if (isPattern(parsed)) {
            entityCommands.insert(new FillPattern(parsed));
          }
        } catch (e) {
          entityCommands.insert(new FillSolid(fill));
        }
      }
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
      entityCommands.insert(
        new Stroke({
          color: stroke,
          width: strokeWidth,
          // comma and/or white space separated
          dasharray:
            strokeDasharray === 'none'
              ? [0, 0]
              : ((strokeDasharray?.includes(',')
                ? strokeDasharray?.split(',')
                : strokeDasharray?.split(' ')
              )?.map(Number) as [number, number]),
          linecap: strokeLinecap,
          linejoin: strokeLinejoin,
          miterlimit: strokeMiterlimit,
          dashoffset: strokeDashoffset,
          alignment: strokeAlignment,
        }),
      );
    }

    const { markerStart, markerEnd, markerFactor } =
      attributes as MarkerAttributes;
    if (markerStart || markerEnd) {
      entityCommands.insert(
        new Marker({
          start: markerStart,
          end: markerEnd,
          factor: markerFactor,
        }),
      );
    }

    if (opacity || fillOpacity || strokeOpacity) {
      entityCommands.insert(
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
      entityCommands.insert(
        new DropShadow({
          color: dropShadowColor,
          blurRadius: dropShadowBlurRadius,
          offsetX: dropShadowOffsetX,
          offsetY: dropShadowOffsetY,
        }),
      );
    }

    const {
      innerShadowBlurRadius,
      innerShadowColor,
      innerShadowOffsetX,
      innerShadowOffsetY,
    } = attributes as InnerShadowAttributes;
    if (innerShadowBlurRadius) {
      entityCommands.insert(
        new InnerShadow({
          color: innerShadowColor,
          blurRadius: innerShadowBlurRadius,
          offsetX: innerShadowOffsetX,
          offsetY: innerShadowOffsetY,
        }),
      );
    }

    const { visibility } = attributes as VisibilityAttributes;
    entityCommands.insert(new Visibility(visibility));

    const { name } = attributes as NameAttributes;
    entityCommands.insert(new Name(name));

    const { lockAspectRatio } = attributes;
    if (lockAspectRatio) {
      entityCommands.insert(new LockAspectRatio());
    }

    const { zIndex } = attributes;
    entityCommands.insert(new ZIndex(zIndex ?? 0));

    const { sizeAttenuation, strokeAttenuation } =
      attributes as AttenuationAttributes;
    if (sizeAttenuation) {
      entityCommands.insert(new SizeAttenuation());
    }
    if (strokeAttenuation) {
      entityCommands.insert(new StrokeAttenuation());
    }

    const { wireframe } = attributes as WireframeAttributes;
    if (wireframe) {
      entityCommands.insert(new Wireframe(true));
    }

    const { locked } = attributes;
    if (locked) {
      entityCommands.insert(new Locked());
    }

    const { filter } = attributes as FilterAttributes;
    if (filter) {
      entityCommands.insert(new Filter({ value: filter }));
    }

    const { display } = attributes as FlexboxLayoutAttributes;
    if (display === 'flex') {
      entityCommands.insert(new Flex());
    }

    if (parentId) {
      idEntityMap.get(parentId)?.appendChild(entityCommands);
    }

    entities.push(entityCommands.id().hold());
  }

  return { entities, idEntityMap };
}
