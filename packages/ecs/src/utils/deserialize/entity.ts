import { isNil, isString } from '@antv/util';
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
  Locked,
} from '../../components';
import {
  AttenuationAttributes,
  BrushSerializedNode,
  DropShadowAttributes,
  EdgeSerializedNode,
  EmbedSerializedNode,
  FillAttributes,
  FilterAttributes,
  HtmlSerializedNode,
  InnerShadowAttributes,
  isDataUrl,
  isUrl,
  LineSerializedNode,
  MarkerAttributes,
  NameAttributes,
  PathSerializedNode,
  PolylineSerializedNode,
  RectSerializedNode,
  RoughAttributes,
  serializeBrushPoints,
  SerializedNode,
  serializePoints,
  shiftPath,
  StrokeAttributes,
  TextSerializedNode,
  VectorNetworkSerializedNode,
  VisibilityAttributes,
  WireframeAttributes,
} from '../serialize';
import { deserializeBrushPoints, deserializePoints } from './points';
import { EntityCommands, Commands } from '../../commands';
import { isGradient } from '../gradient';
import { isPattern } from '../pattern';
import { computeBidi, measureText } from '../../systems/ComputeTextMetrics';
import { DOMAdapter } from '../../environment';
import { safeAddComponent } from '../../history';
import { updateFixedTerminalPoints, updateFloatingTerminalPoints, updatePoints } from '../binding';

export function inferXYWidthHeight(node: SerializedNode) {
  const { x, y, width, height } = node;
  if (isString(x) || isString(y) || isString(width) || isString(height)) {
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
    if (type === 'rect') {
      bounds = Rect.getGeometryBounds(node as Partial<Rect>);
    } else if (type === 'ellipse') {
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

export function inferPointsWithFromIdAndToId(
  from: SerializedNode,
  to: SerializedNode,
  edge: LineSerializedNode,
) {
  inferXYWidthHeight(from);
  inferXYWidthHeight(to);

  const state = edge as LineSerializedNode & { width: number; height: number; x: number; y: number } & { absolutePoints: (IPointData | null)[] };
  state.absolutePoints = [null, null];
  updateFixedTerminalPoints(state, from as SerializedNode & { width: number; height: number; x: number; y: number }, to as SerializedNode & { width: number; height: number; x: number; y: number });
  updatePoints(state, null, from as SerializedNode & { width: number; height: number; x: number; y: number }, to as SerializedNode & { width: number; height: number; x: number; y: number });
  updateFloatingTerminalPoints(state, from as SerializedNode & { width: number; height: number; x: number; y: number }, to as SerializedNode & { width: number; height: number; x: number; y: number });

  edge.x1 = state.absolutePoints[0].x;
  edge.y1 = state.absolutePoints[0].y;
  edge.x2 = state.absolutePoints[1].x;
  edge.y2 = state.absolutePoints[1].y;
  delete state.absolutePoints;
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
    if (node.type === 'line' || node.type === 'polyline' || node.type === 'path') {
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

    const { parentId, type } = node;
    const attributes = node;

    const entityCommands = commands.spawn();
    idEntityMap.set(id, entityCommands);

    // Infer points with fromId and toId first
    if (type === 'line' || type === 'rough-line') {
      const { fromId, toId } = attributes as EdgeSerializedNode;
      if (fromId && toId) {
        const fromNode = nodes.find((node) => node.id === fromId);
        const toNode = nodes.find((node) => node.id === toId);
        if (fromNode && toNode) {
          inferPointsWithFromIdAndToId(
            fromNode,
            toNode,
            attributes as LineSerializedNode,
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

    const { x, y, width, height, rotation = 0, scaleX = 1, scaleY = 1 } = attributes;
    const absoluteX = isString(x) ? 0 : x;
    const absoluteY = isString(y) ? 0 : y;
    const absoluteWidth = isString(width) ? 0 : width;
    const absoluteHeight = isString(height) ? 0 : height;

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
    } else if (type === 'path') {
      const { d, fillRule, tessellationMethod } =
        attributes as PathSerializedNode;
      entityCommands.insert(new Path({ d, fillRule, tessellationMethod }));
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
        letterSpacing = 0,
        lineHeight = 0,
        whiteSpace = 'normal',
        wordWrap = false,
        wordWrapWidth,
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
          letterSpacing,
          lineHeight,
          whiteSpace,
          wordWrap,
          wordWrapWidth,
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
    entityCommands.insert(new ZIndex(zIndex));

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

    if (parentId) {
      idEntityMap.get(parentId)?.appendChild(entityCommands);
    }

    entities.push(entityCommands.id().hold());
  }

  return { entities, idEntityMap };
}
