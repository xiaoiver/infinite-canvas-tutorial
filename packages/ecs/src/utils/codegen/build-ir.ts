/**
 * `.ic` SerializedNode[] → 框架无关的 {@link CodeIR}。
 *
 * 这是 design-to-code 工作量的主体：把场景图节点按「概念映射表」翻译为元素 + 结构化样式 +
 * 组件定义。具体框架的字符串生成交给各 emitter。
 */
import type {
  IconFontSerializedNode,
  RefSerializedNode,
  SerializedNode,
  SerializedFillLayerItem,
  TextSerializedNode,
} from '../../types/serialized-node';
import {
  designVariableRefKeyFromWire,
  isDesignVariableReference,
  resolveSerializedNodesDesignVariables,
  resolveSerializedNodesTextVariables,
  type DesignVariablesMap,
} from '../design-variables';
import { expandRefSerializedNodes } from '../deserialize/expand-ref-nodes';
import type { ThemeMode } from '../../components/Theme';
import { toComponentName, toPropName } from './string-utils';
import { boxToCss, styleValueToCss, textDecorationToCss } from './emit-style';
import { toCSSMixBlendMode } from '../blend-mode';
import { hasUnsupportedPaintFillOverride } from './paint-fill-override';
import {
  cssBackgroundGradient,
  isCssGradient,
  singleCssGradientFill,
} from './gradient-fill';
import { pathGeometryBounds } from '../path-rendering';
import { parsePath } from '../curve/shape-path';
import { parsePatternTransform } from '../pattern-transform';
import {
  computeLinearGradient,
  computeRadialGradient,
  isGradient,
  parseGradient,
} from '../gradient';
import type {
  CodeBindingTarget,
  CodeComponentDef,
  CodeComponentProp,
  CodeIR,
  CodeNode,
  CodeNodeRole,
  CodeSemanticElement,
  CodegenOptions,
  CodeVariablesMode,
  CodeVectorMarker,
  CodeVectorGradient,
  CodeVectorImage,
  CodeVectorFillLayer,
  CodeVectorStrokeLayer,
  CodePaintOverlay,
  StyleIR,
  StyleValue,
} from './types';

type AnyNode = SerializedNode & Record<string, unknown>;

/** 实例覆盖键（含合成的 `dropShadow`）→ prop 绑定目标。 */
const OVERRIDABLE_KEY_TO_TARGET: Record<string, CodeBindingTarget> = {
  content: 'text',
  fontSize: 'fontSize',
  cornerRadius: 'borderRadius',
  width: 'width',
  height: 'height',
  strokeWidth: 'borderWidth',
  opacity: 'opacity',
  visibility: 'visibility',
  fontWeight: 'fontWeight',
  fontStyle: 'fontStyle',
  fontVariant: 'fontVariant',
  fontKerning: 'fontKerning',
  fontFamily: 'fontFamily',
  textAlign: 'textAlign',
  wordWrapWidth: 'textWrapWidth',
  letterSpacing: 'letterSpacing',
  lineHeight: 'lineHeight',
  textDecoration: 'textDecoration',
  dropShadow: 'boxShadow',
  padding: 'padding',
  margin: 'margin',
  gap: 'gap',
  rowGap: 'rowGap',
  columnGap: 'columnGap',
  flexDirection: 'flexDirection',
  alignItems: 'alignItems',
  justifyContent: 'justifyContent',
  flexWrap: 'flexWrap',
  alignSelf: 'alignSelf',
  flexGrow: 'flexGrow',
  flexShrink: 'flexShrink',
  flexBasis: 'flexBasis',
  blendMode: 'mixBlendMode',
  minWidth: 'minWidth',
  maxWidth: 'maxWidth',
  minHeight: 'minHeight',
  maxHeight: 'maxHeight',
};

const SHADOW_KEYS = new Set([
  'dropShadowColor',
  'dropShadowOffsetX',
  'dropShadowOffsetY',
  'dropShadowBlurRadius',
]);
const DECORATION_KEYS = new Set([
  'decorationLine',
  'decorationStyle',
  'decorationColor',
  'decorationThickness',
]);

function shadowStyleValue(
  template: AnyNode,
  patch: Record<string, unknown> | undefined,
  mode: CodeVariablesMode,
): StyleValue {
  const shadow = { ...template, ...patch };
  const color = toStyleValue(shadow.dropShadowColor as string);
  if (!color || color.literal === 'none') return { literal: 'none' };
  const px = (raw: unknown) =>
    styleValueToCss(
      toStyleValue(raw as string | number) ?? { literal: 0 },
      mode,
      true,
    );
  return {
    literal: `${px(shadow.dropShadowOffsetX)} ${px(
      shadow.dropShadowOffsetY,
    )} ${px(shadow.dropShadowBlurRadius)} ${styleValueToCss(color, mode)}`,
  };
}

function textDecorationStyleValue(
  template: AnyNode,
  patch: Record<string, unknown> | undefined,
  mode: CodeVariablesMode,
): StyleValue {
  const decoration = textDecorationFromNode({ ...template, ...patch });
  return {
    literal: decoration ? textDecorationToCss(decoration, mode) : 'none',
  };
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

/** 把一个值包装为 {@link StyleValue}：`$token` → token，其余 → literal。 */
function toStyleValue(
  raw: string | number | null | undefined,
): StyleValue | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw === 'string' && isDesignVariableReference(raw)) {
    return { token: designVariableRefKeyFromWire(raw) };
  }
  return { literal: raw };
}

function textDecorationFromNode(node: AnyNode): StyleIR['textDecoration'] {
  const line = node.decorationLine;
  const thickness = Number(node.decorationThickness ?? 0);
  if (
    !['underline', 'overline', 'line-through'].includes(line as string) ||
    !Number.isFinite(thickness) ||
    thickness <= 0
  )
    return undefined;
  const decorationStyle = node.decorationStyle;
  return {
    line: line as NonNullable<StyleIR['textDecoration']>['line'],
    style: (['solid', 'double', 'dotted', 'dashed', 'wavy'].includes(
      decorationStyle as string,
    )
      ? decorationStyle
      : 'solid') as NonNullable<StyleIR['textDecoration']>['style'],
    color: toStyleValue(node.decorationColor as string) ?? {
      literal: 'black',
    },
    thickness,
  };
}

/** 取填充/描边栈里第一层启用的 solid 颜色（含 `$token`）。 */
function primaryColorFromLayers(
  layers: SerializedFillLayerItem[] | undefined,
): StyleValue | undefined {
  if (!layers || layers.length === 0) {
    return undefined;
  }
  for (const layer of layers) {
    if (layer.enabled === false) {
      continue;
    }
    if (layer.type === 'solid') {
      return toStyleValue(layer.value);
    }
  }
  return undefined;
}

/** 取第一层启用的 image 资源 URL。 */
function primaryImageFromLayers(
  layers: SerializedFillLayerItem[] | undefined,
): StyleValue | undefined {
  if (!layers) {
    return undefined;
  }
  for (const layer of layers) {
    if (layer.enabled === false) {
      continue;
    }
    if (layer.type === 'image') {
      return toStyleValue(layer.value);
    }
  }
  return undefined;
}

function normalizeBox(
  v: number | number[] | undefined,
): [number, number, number, number] | undefined {
  if (v === undefined) {
    return undefined;
  }
  if (typeof v === 'number') {
    return [v, v, v, v];
  }
  if (v.length === 2) {
    return [v[0], v[1], v[0], v[1]];
  }
  if (v.length === 4) {
    return [v[0], v[1], v[2], v[3]];
  }
  if (v.length === 1) {
    return [v[0], v[0], v[0], v[0]];
  }
  return undefined;
}

function supportsCssBackgroundLayers(
  activeFills: SerializedFillLayerItem[],
): boolean {
  return (
    (activeFills.length > 1 ||
      (activeFills.length === 1 && activeFills[0].type === 'pattern')) &&
    activeFills.every((fill, index) => {
      if (
        index > 0 &&
        fill.blendMode !== undefined &&
        fill.blendMode !== 'normal' &&
        toCSSMixBlendMode(fill.blendMode) === null
      )
        return false;
      if (fill.type === 'solid') return !!toStyleValue(fill.value);
      if (fill.type === 'gradient')
        return (
          !!cssBackgroundGradient(fill.value) &&
          (fill.opacity === undefined || Number(fill.opacity) === 1)
        );
      if (fill.type === 'image')
        return (
          !!fill.value.trim() &&
          ['fill', 'contain', 'cover', 'none'].includes(
            fill.objectFit ?? 'fill',
          ) &&
          (fill.opacity === undefined || Number(fill.opacity) === 1)
        );
      if (fill.type === 'pattern')
        return (
          !!fill.value.trim() &&
          !fill.transform &&
          (fill.opacity === undefined || Number(fill.opacity) === 1)
        );
      return false;
    })
  );
}

function supportsPaintOverlays(
  node: AnyNode,
  activeFills: SerializedFillLayerItem[],
): boolean {
  return (
    activeFills.length > 0 &&
    !(activeFills.length === 1 && activeFills[0].type === 'image') &&
    activeFills.some(
      (fill) =>
        (fill.type !== 'solid' &&
          fill.opacity !== undefined &&
          Number(fill.opacity) !== 1) ||
        (fill.type === 'image' && fill.objectFit === 'scale-down') ||
        (fill.type === 'pattern' && !!fill.transform),
    ) &&
    activeFills.every((fill, index) => {
      if (
        index > 0 &&
        fill.blendMode !== undefined &&
        fill.blendMode !== 'normal' &&
        toCSSMixBlendMode(fill.blendMode) === null
      )
        return false;
      if (fill.type === 'solid') return !!toStyleValue(fill.value);
      if (fill.type === 'gradient') return !!cssBackgroundGradient(fill.value);
      if (fill.type === 'image') return !!fill.value.trim();
      if (fill.type === 'pattern')
        return (
          !!fill.value.trim() &&
          (!fill.transform ||
            (typeof node.width === 'number' &&
              node.width > 0 &&
              typeof node.height === 'number' &&
              node.height > 0 &&
              !!parsePatternTransform(fill.transform)))
        );
      return false;
    })
  );
}

function decideRole(node: AnyNode): CodeNodeRole {
  switch (node.type) {
    case 'text':
      return 'text';
    case 'iconfont':
      return 'icon';
    case 'g':
      return 'container';
    case 'rect': {
      const fills = asArray<SerializedFillLayerItem>(node.fills).filter(
        (fill) => fill.enabled !== false,
      );
      if (fills.some((fill) => fill.type === 'image')) {
        return supportsCssBackgroundLayers(fills) ||
          supportsPaintOverlays(node, fills)
          ? 'container'
          : 'image';
      }
      return 'container';
    }
    case 'rough-rect': {
      const fills = asArray<SerializedFillLayerItem>(node.fills);
      if (fills.some((l) => l.type === 'image' && l.enabled !== false)) {
        return 'image';
      }
      // flex 容器或有子节点者视作容器
      return 'container';
    }
    case 'ellipse': {
      const fills = asArray<SerializedFillLayerItem>(node.fills).filter(
        (fill) => fill.enabled !== false,
      );
      return fills.length === 1 && fills[0].type === 'image'
        ? 'image'
        : 'shape';
    }
    default:
      return 'shape';
  }
}

function vectorPathData(node: AnyNode): string | undefined {
  if (node.type === 'path')
    return typeof node.d === 'string' && node.d.trim() ? node.d : undefined;
  if (node.type === 'line') {
    const coords = [node.x1, node.y1, node.x2, node.y2];
    if (
      !coords.every(
        (value) => typeof value === 'number' && Number.isFinite(value),
      )
    )
      return undefined;
    return `M ${coords[0]} ${coords[1]} L ${coords[2]} ${coords[3]}`;
  }
  if (node.type === 'polyline' && typeof node.points === 'string') {
    const numbers = node.points
      .trim()
      .split(/[,\s]+/)
      .map(Number);
    if (
      numbers.length < 4 ||
      numbers.length % 2 !== 0 ||
      !numbers.every(Number.isFinite)
    )
      return undefined;
    let d = `M ${numbers[0]} ${numbers[1]}`;
    for (let i = 2; i < numbers.length; i += 2)
      d += ` L ${numbers[i]} ${numbers[i + 1]}`;
    return d;
  }
  return undefined;
}

function vectorMarker(
  node: AnyNode,
  side: 'start' | 'end',
  strokeWidth: number,
  layerIndex?: number,
): CodeVectorMarker | undefined {
  const type = node[side === 'start' ? 'markerStart' : 'markerEnd'];
  if (!['line', 'triangle', 'diamond'].includes(type as string))
    return undefined;
  const factor =
    typeof node.markerFactor === 'number' &&
    Number.isFinite(node.markerFactor) &&
    node.markerFactor > 0
      ? node.markerFactor
      : 3;
  const radius = strokeWidth * factor;
  const size = radius * factor;
  const tipX = -radius * Math.cos(Math.PI / 6);
  const tipY = radius * 0.5;
  const d =
    type === 'diamond'
      ? `M 0 0 L ${-radius * 0.5} ${-radius * 0.4} L ${-radius} 0 L ${
          -radius * 0.5
        } ${radius * 0.4} Z`
      : `M ${tipX} ${-tipY} L 0 0 L ${tipX} ${tipY}${
          type === 'triangle' ? ' Z' : ''
        }`;
  // Use a reversible, CSS-safe encoding so unrelated nodes never share a marker ID.
  const encodedId = Array.from(node.id as string)
    .map((character) => character.codePointAt(0)!.toString(16))
    .join('-');
  return {
    id: `ic-marker-${encodedId}-${side}${
      layerIndex === undefined ? '' : `-${layerIndex}`
    }`,
    d,
    fill: type !== 'line',
    size,
    offset: radius,
    strokeWidth,
    strokeLinecap: ['butt', 'round', 'square'].includes(
      node.strokeLinecap as string,
    )
      ? (node.strokeLinecap as CodeVectorMarker['strokeLinecap'])
      : undefined,
    strokeLinejoin: ['miter', 'round', 'bevel'].includes(
      node.strokeLinejoin as string,
    )
      ? (node.strokeLinejoin as CodeVectorMarker['strokeLinejoin'])
      : undefined,
  };
}

function vectorGradient(
  node: AnyNode,
  kind: 'fill' | 'stroke',
  layers: SerializedFillLayerItem[],
  min: [number, number],
  width: number,
  height: number,
  idSuffix: string = kind,
): CodeVectorGradient | undefined {
  const active = layers.filter((layer) => layer.enabled !== false);
  const layer = active.length === 1 ? active[0] : undefined;
  const value =
    layer?.type === 'gradient' &&
    (layer.blendMode === undefined || layer.blendMode === 'normal')
      ? layer.value
      : active.length === 0 && isCssGradient(node[kind])
      ? (node[kind] as string)
      : undefined;
  if (!value) return undefined;
  let gradients: ReturnType<typeof parseGradient>;
  try {
    gradients = parseGradient(value);
  } catch {
    return undefined;
  }
  if (gradients?.length !== 1) return undefined;
  const gradient = gradients[0];
  if (
    (gradient.type !== 'linear-gradient' &&
      gradient.type !== 'radial-gradient') ||
    gradient.steps.length === 0
  )
    return undefined;
  const stops = gradient.steps.map((step) => ({
    offset:
      step.offset.type === '%'
        ? step.offset.value / 100
        : step.offset.value <= 1
        ? step.offset.value
        : step.offset.value / 100,
    color: step.color,
  }));
  if (
    !stops.every(
      (stop) => Number.isFinite(stop.offset) && stop.color.trim() !== '',
    )
  )
    return undefined;
  const encodedId = Array.from(node.id as string)
    .map((character) => character.codePointAt(0)!.toString(16))
    .join('-');
  const geometry =
    gradient.type === 'linear-gradient'
      ? {
          type: 'linear' as const,
          ...computeLinearGradient(min, width, height, gradient.angle),
        }
      : (() => {
          const { x, y, r } = computeRadialGradient(
            min,
            width,
            height,
            gradient.cx,
            gradient.cy,
            gradient.size,
          );
          return { type: 'radial' as const, cx: x, cy: y, r };
        })();
  if (
    !Object.values(geometry).every((coordinate) =>
      typeof coordinate === 'number' ? Number.isFinite(coordinate) : true,
    )
  )
    return undefined;
  return { id: `ic-gradient-${encodedId}-${idSuffix}`, geometry, stops };
}

function svgImageAlignment(
  position: string | undefined,
): `x${'Min' | 'Mid' | 'Max'}Y${'Min' | 'Mid' | 'Max'}` | undefined {
  if (position === undefined) return 'xMidYMid';
  const parts = position.trim().toLowerCase().split(/\s+/);
  if (parts.length < 1 || parts.length > 2) return undefined;
  const axis = (
    token: string,
    horizontal: boolean,
  ): 'Min' | 'Mid' | 'Max' | undefined => {
    if (token === 'center' || token === '50%') return 'Mid';
    if (token === '0%' || token === (horizontal ? 'left' : 'top')) return 'Min';
    if (token === '100%' || token === (horizontal ? 'right' : 'bottom'))
      return 'Max';
    return undefined;
  };
  if (parts.length === 1) {
    const x = axis(parts[0], true);
    if (x) return `x${x}YMid`;
    const y = axis(parts[0], false);
    return y ? `xMidY${y}` : undefined;
  }
  const x = axis(parts[0], true);
  const y = axis(parts[1], false);
  if (x && y) return `x${x}Y${y}`;
  // CSS also accepts vertical-first keyword pairs, including `center left`.
  const reversedY = axis(parts[0], false);
  const reversedX = axis(parts[1], true);
  if (
    reversedX &&
    reversedY &&
    ((['top', 'bottom'].includes(parts[0]) &&
      ['left', 'right', 'center'].includes(parts[1])) ||
      (parts[0] === 'center' && ['left', 'right'].includes(parts[1])))
  )
    return `x${reversedX}Y${reversedY}`;
  return undefined;
}

function vectorImage(
  node: AnyNode,
  kind: 'fill' | 'stroke',
  layers: SerializedFillLayerItem[],
  idSuffix: string = kind,
): CodeVectorImage | undefined {
  if (layers.length !== 1 || layers[0].type !== 'image') return undefined;
  const image = layers[0];
  if (
    !image.value.trim() ||
    (image.blendMode !== undefined && image.blendMode !== 'normal')
  )
    return undefined;
  const fit = image.objectFit ?? 'fill';
  const encodedId = Array.from(node.id as string)
    .map((character) => character.codePointAt(0)!.toString(16))
    .join('-');
  const id = `ic-image-${encodedId}-${idSuffix}`;
  const alignment = svgImageAlignment(image.objectPosition);
  if (alignment && ['fill', 'contain', 'cover'].includes(fit))
    return {
      id,
      href: image.value,
      rendering: 'pattern',
      preserveAspectRatio:
        fit === 'cover'
          ? `${alignment} slice`
          : fit === 'contain'
          ? `${alignment} meet`
          : 'none',
    };
  return {
    id,
    href: image.value,
    rendering: 'foreignObject',
    objectFit: fit,
    objectPosition: image.objectPosition ?? '50% 50%',
  };
}

function buildVectorPath(node: AnyNode): CodeNode['vectorPath'] {
  const d = vectorPathData(node);
  if (!d) return undefined;
  let bounds: ReturnType<typeof pathGeometryBounds>;
  try {
    bounds = pathGeometryBounds(d);
  } catch {
    return undefined;
  }
  if (
    ![bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every(Number.isFinite)
  )
    return undefined;
  const dimension = (raw: unknown, span: number) =>
    typeof raw === 'number' && Number.isFinite(raw) && raw > 0
      ? raw
      : Math.max(1, span);
  const fills = asArray<SerializedFillLayerItem>(node.fills).filter(
    (fill) => fill.enabled !== false,
  );
  const strokes = asArray<SerializedFillLayerItem>(node.strokes).filter(
    (stroke) => stroke.enabled !== false,
  );
  const fillLayer = fills.find((fill) => fill.type === 'solid');
  const strokeLayer = strokes.find((stroke) => stroke.type === 'solid');
  const gradientFillLayer = fills.find((fill) => fill.type === 'gradient');
  const gradientStrokeLayer = strokes.find(
    (stroke) => stroke.type === 'gradient',
  );
  const imageFillLayer = fills.find((fill) => fill.type === 'image');
  const imageStrokeLayer = strokes.find((stroke) => stroke.type === 'image');
  const singleFill =
    node.type === 'path'
      ? (fillLayer?.type === 'solid' && toStyleValue(fillLayer.value)) ||
        (typeof node.fill === 'string' && isGradient(node.fill)
          ? undefined
          : toStyleValue(node.fill as string))
      : undefined;
  const stroke =
    (strokeLayer?.type === 'solid' && toStyleValue(strokeLayer.value)) ||
    (typeof node.stroke === 'string' && isGradient(node.stroke)
      ? undefined
      : toStyleValue(node.stroke as string));
  const strokeWidth =
    typeof node.strokeWidth === 'number' ? node.strokeWidth : 1;
  const width = dimension(node.width, bounds.maxX - bounds.minX);
  const height = dimension(node.height, bounds.maxY - bounds.minY);
  const viewBoxX = bounds.minX - (bounds.maxX === bounds.minX ? 0.5 : 0);
  const viewBoxY = bounds.minY - (bounds.maxY === bounds.minY ? 0.5 : 0);
  const fillLayers =
    node.type === 'path' &&
    fills.length > 1 &&
    fills.every(
      (layer, index) =>
        index === 0 ||
        layer.blendMode === undefined ||
        layer.blendMode === 'normal' ||
        toCSSMixBlendMode(layer.blendMode) !== null,
    )
      ? fills.map((layer, index): CodeVectorFillLayer => {
          // Paint parsing is independent of how the layer blends with its backdrop.
          const paintLayer = { ...layer, blendMode: 'normal' as const };
          return {
            fill:
              layer.type === 'solid' ? toStyleValue(layer.value) : undefined,
            fillGradient: vectorGradient(
              node,
              'fill',
              [paintLayer],
              [viewBoxX, viewBoxY],
              width,
              height,
              `fill-${index}`,
            ),
            fillImage: vectorImage(node, 'fill', [paintLayer], `fill-${index}`),
            fillOpacity: toStyleValue(layer.opacity as string | number),
            blendMode:
              index > 0
                ? toCSSMixBlendMode(layer.blendMode) ?? undefined
                : undefined,
          };
        })
      : undefined;
  const supportedFillLayers = fillLayers?.every(
    (layer) => layer.fill || layer.fillGradient || layer.fillImage,
  )
    ? fillLayers
    : undefined;
  const strokeLayers =
    strokeWidth > 0 &&
    strokes.length > 1 &&
    strokes.every(
      (layer, index) =>
        index === 0 ||
        layer.blendMode === undefined ||
        layer.blendMode === 'normal' ||
        toCSSMixBlendMode(layer.blendMode) !== null,
    )
      ? strokes.map(
          (layer, index): CodeVectorStrokeLayer => ({
            stroke:
              layer.type === 'solid' ? toStyleValue(layer.value) : undefined,
            strokeGradient: vectorGradient(
              node,
              'stroke',
              [{ ...layer, blendMode: 'normal' }],
              [viewBoxX, viewBoxY],
              width,
              height,
              `stroke-${index}`,
            ),
            strokeImage: vectorImage(
              node,
              'stroke',
              [{ ...layer, blendMode: 'normal' }],
              `stroke-${index}`,
            ),
            strokeOpacity: toStyleValue(
              (layer.opacity ?? node.strokeOpacity) as string | number,
            ),
            blendMode:
              index > 0
                ? toCSSMixBlendMode(layer.blendMode) ?? undefined
                : undefined,
            markerStart: vectorMarker(node, 'start', strokeWidth, index),
            markerEnd: vectorMarker(node, 'end', strokeWidth, index),
          }),
        )
      : undefined;
  const supportedStrokeLayers = strokeLayers?.every(
    (layer) => layer.stroke || layer.strokeGradient || layer.strokeImage,
  )
    ? strokeLayers
    : undefined;
  const fill = supportedFillLayers ? undefined : singleFill;
  const fillGradient =
    node.type === 'path' && !supportedFillLayers
      ? vectorGradient(node, 'fill', fills, [viewBoxX, viewBoxY], width, height)
      : undefined;
  const strokeGradient =
    strokeWidth > 0 && !supportedStrokeLayers
      ? vectorGradient(
          node,
          'stroke',
          strokes,
          [viewBoxX, viewBoxY],
          width,
          height,
        )
      : undefined;
  const fillImage =
    node.type === 'path' && !supportedFillLayers
      ? vectorImage(node, 'fill', fills)
      : undefined;
  const strokeImage =
    strokeWidth > 0 && !supportedStrokeLayers
      ? vectorImage(node, 'stroke', strokes)
      : undefined;
  const alignment = node.strokeAlignment;
  let strokeAlignment: NonNullable<CodeNode['vectorPath']>['strokeAlignment'];
  if (
    node.type === 'path' &&
    (supportedStrokeLayers || stroke || strokeGradient || strokeImage) &&
    strokeWidth > 0 &&
    (alignment === 'inner' || alignment === 'outer')
  ) {
    const subpaths = parsePath(d).subPaths;
    if (subpaths.length > 0 && subpaths.every((subpath) => subpath.autoClose)) {
      const encodedId = Array.from(node.id as string)
        .map((character) => character.codePointAt(0)!.toString(16))
        .join('-');
      strokeAlignment = {
        type: alignment,
        id: `ic-stroke-${encodedId}`,
      };
    }
  }
  return {
    d,
    viewBoxX,
    viewBoxY,
    width,
    height,
    fill,
    fillGradient,
    fillImage,
    fillLayers: supportedFillLayers,
    fillOpacity:
      fill || fillGradient || fillImage
        ? toStyleValue(
            (fillLayer?.opacity ??
              gradientFillLayer?.opacity ??
              imageFillLayer?.opacity ??
              node.fillOpacity) as string | number,
          )
        : undefined,
    fillRule:
      node.type === 'path' && node.fillRule === 'evenodd'
        ? 'evenodd'
        : 'nonzero',
    stroke: strokeWidth > 0 && !supportedStrokeLayers ? stroke : undefined,
    strokeGradient,
    strokeImage,
    strokeLayers: supportedStrokeLayers,
    strokeOpacity:
      !supportedStrokeLayers && (stroke || strokeGradient || strokeImage)
        ? toStyleValue(
            (strokeLayer?.opacity ??
              gradientStrokeLayer?.opacity ??
              imageStrokeLayer?.opacity ??
              node.strokeOpacity) as string | number,
          )
        : undefined,
    strokeWidth:
      (supportedStrokeLayers || stroke || strokeGradient || strokeImage) &&
      strokeWidth > 0
        ? strokeWidth
        : undefined,
    strokeLinecap: ['butt', 'round', 'square'].includes(
      node.strokeLinecap as string,
    )
      ? (node.strokeLinecap as 'butt' | 'round' | 'square')
      : undefined,
    strokeLinejoin: ['miter', 'round', 'bevel'].includes(
      node.strokeLinejoin as string,
    )
      ? (node.strokeLinejoin as 'miter' | 'round' | 'bevel')
      : undefined,
    strokeMiterlimit:
      typeof node.strokeMiterlimit === 'number' &&
      Number.isFinite(node.strokeMiterlimit) &&
      node.strokeMiterlimit > 0
        ? node.strokeMiterlimit
        : undefined,
    strokeDasharray:
      typeof node.strokeDasharray === 'string' &&
      node.strokeDasharray !== '0,0' &&
      node.strokeDasharray !== '0'
        ? node.strokeDasharray
        : undefined,
    strokeDashoffset:
      typeof node.strokeDashoffset === 'number' &&
      Number.isFinite(node.strokeDashoffset)
        ? node.strokeDashoffset
        : undefined,
    strokeAlignment,
    dropShadow:
      typeof node.dropShadowColor === 'string' &&
      node.dropShadowColor.trim() !== '' &&
      node.dropShadowColor !== 'none'
        ? {
            offsetX:
              typeof node.dropShadowOffsetX === 'number' &&
              Number.isFinite(node.dropShadowOffsetX)
                ? node.dropShadowOffsetX
                : 0,
            offsetY:
              typeof node.dropShadowOffsetY === 'number' &&
              Number.isFinite(node.dropShadowOffsetY)
                ? node.dropShadowOffsetY
                : 0,
            blur:
              typeof node.dropShadowBlurRadius === 'number' &&
              Number.isFinite(node.dropShadowBlurRadius) &&
              node.dropShadowBlurRadius > 0
                ? node.dropShadowBlurRadius
                : 0,
            color: toStyleValue(node.dropShadowColor)!,
          }
        : undefined,
    markerStart:
      !supportedStrokeLayers &&
      (stroke || strokeGradient || strokeImage) &&
      strokeWidth > 0
        ? vectorMarker(node, 'start', strokeWidth)
        : undefined,
    markerEnd:
      !supportedStrokeLayers &&
      (stroke || strokeGradient || strokeImage) &&
      strokeWidth > 0
        ? vectorMarker(node, 'end', strokeWidth)
        : undefined,
  };
}

/** 把节点上的样式相关字段映射为结构化 {@link StyleIR}。 */
function buildStyle(
  node: AnyNode,
  role: CodeNodeRole,
  hasChildren: boolean,
): StyleIR {
  const style: StyleIR = {};

  const rotation = Number.isFinite(node.rotation)
    ? (node.rotation as number)
    : 0;
  const scaleX = Number.isFinite(node.scaleX) ? (node.scaleX as number) : 1;
  const scaleY = Number.isFinite(node.scaleY) ? (node.scaleY as number) : 1;
  const cssNumber = (value: number) => String(Number(value.toFixed(6)));
  const transforms: string[] = [];
  if (rotation !== 0) transforms.push(`rotate(${cssNumber(rotation)}rad)`);
  if (scaleX !== 1 || scaleY !== 1)
    transforms.push(`scale(${cssNumber(scaleX)}, ${cssNumber(scaleY)})`);
  if (transforms.length) style.transform = transforms.join(' ');
  if (role === 'text' && style.transform && node.display !== 'flex')
    style.display = 'inline-block';

  // flex 布局
  if (node.display === 'flex') {
    style.display = 'flex';
    if (node.flexDirection) style.flexDirection = node.flexDirection as never;
    if (node.alignItems) style.alignItems = node.alignItems as never;
    if (node.justifyContent)
      style.justifyContent = node.justifyContent as never;
    if (node.flexWrap && node.flexWrap !== 'nowrap')
      style.flexWrap = node.flexWrap as never;
    if (typeof node.gap === 'number') style.gap = node.gap;
    if (typeof node.rowGap === 'number') style.rowGap = node.rowGap;
    if (typeof node.columnGap === 'number') style.columnGap = node.columnGap;
  }
  if (typeof node.flexGrow === 'number' && node.flexGrow)
    style.flexGrow = node.flexGrow;
  if (typeof node.flexShrink === 'number') style.flexShrink = node.flexShrink;
  if (node.alignSelf && node.alignSelf !== 'auto')
    style.alignSelf = node.alignSelf as never;
  if (typeof node.flexBasis === 'number') style.flexBasis = node.flexBasis;

  const padding = normalizeBox(node.padding as number | number[] | undefined);
  if (padding) style.padding = padding;
  const margin = normalizeBox(node.margin as number | number[] | undefined);
  if (margin) style.margin = margin;

  // 反序列化会把未指定尺寸的 flex 容器补为 0；有子节点时应让 CSS 按内容计算。
  const autoSizedContainer =
    role === 'container' && node.display === 'flex' && hasChildren;
  // 尺寸：容器/图片/形状写显式宽高；文本随内容，不强制尺寸
  if (role !== 'text') {
    if (typeof node.width === 'number' && (!autoSizedContainer || node.width))
      style.width = node.width;
    if (typeof node.height === 'number' && (!autoSizedContainer || node.height))
      style.height = node.height;
  }
  if (typeof node.minWidth === 'number') style.minWidth = node.minWidth;
  if (typeof node.maxWidth === 'number') style.maxWidth = node.maxWidth;
  if (typeof node.minHeight === 'number') style.minHeight = node.minHeight;
  if (typeof node.maxHeight === 'number') style.maxHeight = node.maxHeight;
  style.mixBlendMode = toCSSMixBlendMode(node.blendMode as never) ?? undefined;
  if (role === 'image') {
    const activeFills = asArray<SerializedFillLayerItem>(node.fills).filter(
      (fill) => fill.enabled !== false,
    );
    const imageFill = activeFills.find((fill) => fill.type === 'image');
    if (imageFill?.type === 'image') {
      style.objectFit = imageFill.objectFit;
      style.objectPosition = imageFill.objectPosition;
      if (
        activeFills.length === 1 &&
        imageFill.opacity !== undefined &&
        imageFill.opacity !== 1
      ) {
        const opacity = imageFill.opacity;
        style.imageFillOpacity =
          typeof opacity === 'number' || Number.isNaN(Number(opacity))
            ? toStyleValue(opacity)
            : { literal: Number(opacity) };
      }
    }
  }

  const fills = asArray<SerializedFillLayerItem>(node.fills);
  const fillColor = primaryColorFromLayers(fills);
  const activeFills = fills.filter((fill) => fill.enabled !== false);
  if (
    (node.type === 'rect' || node.type === 'ellipse') &&
    supportsCssBackgroundLayers(activeFills)
  )
    style.backgroundLayers = activeFills.map((fill, index) => {
      const blendMode =
        index > 0 ? toCSSMixBlendMode(fill.blendMode) ?? undefined : undefined;
      return fill.type === 'gradient'
        ? {
            type: 'gradient',
            value: cssBackgroundGradient(fill.value)!,
            blendMode,
          }
        : fill.type === 'image'
        ? {
            type: 'image',
            value: fill.value,
            objectFit:
              fill.objectFit === 'contain' ||
              fill.objectFit === 'cover' ||
              fill.objectFit === 'none'
                ? fill.objectFit
                : 'fill',
            objectPosition: fill.objectPosition,
            blendMode,
          }
        : fill.type === 'pattern'
        ? {
            type: 'pattern',
            value: fill.value,
            repetition: fill.repetition,
            blendMode,
          }
        : {
            type: 'solid',
            color: toStyleValue(fill.value as string)!,
            opacity: toStyleValue(fill.opacity as number | string),
            blendMode,
          };
    });
  if (
    (node.type === 'rect' || node.type === 'ellipse') &&
    supportsPaintOverlays(node, activeFills)
  ) {
    style.paintOverlays = activeFills.map((fill, index): CodePaintOverlay => {
      const shared = {
        opacity: toStyleValue(fill.opacity as number | string),
        blendMode:
          index > 0
            ? toCSSMixBlendMode(fill.blendMode) ?? undefined
            : undefined,
      };
      if (fill.type === 'solid')
        return { type: 'solid', color: toStyleValue(fill.value)!, ...shared };
      if (fill.type === 'gradient')
        return {
          type: 'gradient',
          value: cssBackgroundGradient(fill.value)!,
          ...shared,
        };
      if (fill.type === 'image')
        return {
          type: 'image',
          value: fill.value,
          objectFit: fill.objectFit,
          objectPosition: fill.objectPosition,
          ...shared,
        };
      return {
        type: 'pattern',
        value: fill.value,
        repetition: fill.repetition,
        transform: fill.transform,
        ...shared,
      };
    });
    style.backgroundLayers = undefined;
    style.position ??= 'relative';
    style.isolation = 'isolate';
  }
  if (
    fillColor &&
    activeFills.length === 1 &&
    activeFills[0].type === 'solid' &&
    activeFills[0].opacity !== undefined &&
    Number(activeFills[0].opacity) !== 1
  )
    style.solidFillOpacity = toStyleValue(activeFills[0].opacity);
  if (!style.backgroundLayers && !style.paintOverlays) {
    if (role === 'text' || role === 'icon') {
      if (fillColor) style.color = fillColor;
    } else if (role !== 'image' && fillColor) {
      style.backgroundColor = fillColor;
    } else if (role === 'container' || node.type === 'ellipse') {
      const gradient = singleCssGradientFill(fills);
      if (gradient) style.backgroundImage = { literal: gradient };
    }
  }

  // 描边 → border
  const strokes = asArray<SerializedFillLayerItem>(node.strokes);
  const strokeColor =
    primaryColorFromLayers(strokes) ?? toStyleValue(node.stroke as string);
  if (typeof node.strokeWidth === 'number' && node.strokeWidth > 0) {
    style.borderWidth = { literal: node.strokeWidth };
    if (strokeColor) style.borderColor = strokeColor;
  }

  if (node.type === 'ellipse') {
    style.borderRadius = { literal: '50%' };
  } else if (node.cornerRadius !== undefined) {
    const r = toStyleValue(node.cornerRadius as number);
    if (r) style.borderRadius = r;
  }
  if (
    node.clipMode === 'clip' &&
    (node.type === 'rect' || node.type === 'ellipse')
  )
    style.overflow = 'hidden';

  if (
    typeof node.dropShadowColor === 'string' ||
    typeof node.dropShadowBlurRadius === 'number'
  ) {
    const color = toStyleValue(node.dropShadowColor as string);
    if (color && color.literal !== 'none') {
      style.boxShadow = {
        offsetX: (node.dropShadowOffsetX as number) ?? 0,
        offsetY: (node.dropShadowOffsetY as number) ?? 0,
        blur: (node.dropShadowBlurRadius as number) ?? 0,
        color,
      };
    }
  }

  if (typeof node.opacity === 'number' && node.opacity !== 1) {
    style.opacity = node.opacity;
  }
  if (node.visibility === 'hidden' || node.visibility === 'visible')
    style.visibility = node.visibility;

  // 文本排版
  if (role === 'text') {
    const fs = toStyleValue(node.fontSize as number);
    if (fs) style.fontSize = fs;
    if (node.fontWeight !== undefined)
      style.fontWeight = node.fontWeight as string | number;
    if (node.fontStyle && node.fontStyle !== 'normal')
      style.fontStyle = node.fontStyle as string;
    if (typeof node.fontVariant === 'string')
      style.fontVariant = node.fontVariant;
    if (typeof node.fontKerning === 'boolean')
      style.fontKerning = node.fontKerning ? 'normal' : 'none';
    if (typeof node.fontFamily === 'string') style.fontFamily = node.fontFamily;
    if (node.textAlign) style.textAlign = node.textAlign as never;
    style.whiteSpace = node.wordWrap ? 'pre-wrap' : 'pre';
    if (
      node.wordWrap === true &&
      typeof node.wordWrapWidth === 'number' &&
      node.wordWrapWidth > 0
    ) {
      style.textWrapWidth = node.wordWrapWidth;
      if (
        typeof node.maxLines === 'number' &&
        Number.isFinite(node.maxLines) &&
        node.maxLines > 0
      ) {
        style.maxLines = Math.floor(node.maxLines);
        if (node.textOverflow === undefined || node.textOverflow === 'ellipsis')
          style.textOverflow = 'ellipsis';
        else if (node.textOverflow === 'clip') style.textOverflow = 'clip';
      }
    }
    const ls = toStyleValue(node.letterSpacing as number);
    if (ls) style.letterSpacing = ls;
    const lh = toStyleValue(node.lineHeight as number);
    if (lh && lh.literal !== 0) style.lineHeight = lh;
    else style.lineHeightRatio = 1.2;
    style.textDecoration = textDecorationFromNode(node);
  }

  return style;
}

interface BuildContext {
  childrenByParent: Map<string | undefined, AnyNode[]>;
  semanticElements: Record<string, CodeSemanticElement>;
  byId: Map<string, AnyNode>;
  templateToComponentName: Map<string, string>;
  /** 模板 id → 该模板被实例覆盖过的 (key) 集合，用于推断 props。 */
  overridesByTemplate: Map<string, Set<string>>;
  variablesMode: CodeVariablesMode;
}

function sortChildren(nodes: AnyNode[]): AnyNode[] {
  return [...nodes].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
}

/** 递归构建一个节点的 {@link CodeNode}（不含组件实例化）。 */
function buildCodeNode(
  node: AnyNode,
  ctx: BuildContext,
  bindingsForTemplate?: Set<string>,
  inFreeLayout = false,
): CodeNode {
  if (node.type === 'ref') {
    const instance = buildInstanceNode(
      node as RefSerializedNode,
      ctx.templateToComponentName,
      ctx.byId,
      ctx.variablesMode,
    );
    if (instance) {
      if (inFreeLayout) positionFreeChild(instance.style, node);
      else if (node.parentId) instance.style.flexShrink = node.flexShrink ?? 0;
      return instance;
    }
  }
  const role = decideRole(node);
  const children = sortChildren(ctx.childrenByParent.get(node.id) ?? []);
  const style = buildStyle(node, role, children.length > 0);
  // Yoga uses flex-shrink: 0 by default, while CSS flex items default to 1.
  if (!inFreeLayout && node.parentId && style.flexShrink === undefined)
    style.flexShrink = 0;
  const vectorPath = buildVectorPath(node);
  if (vectorPath) {
    style.width = vectorPath.width;
    style.height = vectorPath.height;
    style.overflow = 'visible';
    delete style.backgroundColor;
    delete style.backgroundImage;
    delete style.solidFillOpacity;
    delete style.borderWidth;
    delete style.borderColor;
    delete style.boxShadow;
  }
  if (inFreeLayout) positionFreeChild(style, node);
  else if (children.length > 0 && node.display !== 'flex')
    style.position = 'relative';
  if (role === 'image' && children.length > 0) {
    style.position ??= 'relative';
    style.isolation = 'isolate';
  }
  const codeNode: CodeNode = {
    role,
    id: node.id,
    name: typeof node.name === 'string' ? node.name : undefined,
    element: ctx.semanticElements[node.id],
    style,
    children: [],
    vectorPath,
  };

  if (role === 'text') {
    const content = (node as TextSerializedNode).content;
    codeNode.text = toStyleValue(content) ?? { literal: '' };
  } else if (role === 'icon') {
    const iconNode = node as IconFontSerializedNode;
    codeNode.icon = {
      name: toStyleValue(iconNode.iconFontName) ?? { literal: '' },
      family:
        typeof iconNode.iconFontFamily === 'string'
          ? iconNode.iconFontFamily
          : 'lucide',
    };
  } else if (role === 'image') {
    codeNode.image = primaryImageFromLayers(
      asArray<SerializedFillLayerItem>(node.fills),
    );
  }

  // 组件 body 内：根据模板被覆盖的键，给该节点挂上 prop 绑定
  if (bindingsForTemplate && bindingsForTemplate.size) {
    for (const key of bindingsForTemplate) {
      const [descId, attr] = key.split('::');
      if (descId !== node.id) {
        continue;
      }
      const target =
        OVERRIDABLE_KEY_TO_TARGET[attr] ?? colorTargetFor(attr, role, node);
      if (!target) {
        continue;
      }
      codeNode.bindings = codeNode.bindings ?? [];
      codeNode.bindings.push({
        target,
        prop: propNameFor(node, attr),
      });
    }
  }

  codeNode.children = children.map((c) =>
    buildCodeNode(c, ctx, bindingsForTemplate, node.display !== 'flex'),
  );
  return codeNode;
}

/** Canvas coordinates are local to the parent when Yoga is not laying out children. */
function positionFreeChild(style: StyleIR, node: AnyNode): void {
  style.position = 'absolute';
  style.left =
    typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : 0;
  style.top =
    typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : 0;
}

function colorTargetFor(
  attr: string,
  role: CodeNodeRole,
  node: AnyNode,
): CodeBindingTarget | undefined {
  if (attr === 'fills' || attr === 'fill') {
    if (role === 'image') return 'imageSrc';
    if (
      (role === 'container' || node.type === 'ellipse') &&
      singleCssGradientFill(asArray<SerializedFillLayerItem>(node.fills))
    )
      return 'backgroundImage';
    return role === 'text' || role === 'icon' ? 'color' : 'backgroundColor';
  }
  if (attr === 'strokes' || attr === 'stroke') {
    return role === 'container' || role === 'shape' ? 'borderColor' : undefined;
  }
  return undefined;
}

function propNameFor(node: AnyNode, attr: string): string {
  const base = toPropName(
    typeof node.name === 'string' ? node.name : undefined,
    node.id,
  );
  if (attr === 'content') {
    return base;
  }
  return `${base}${attr.charAt(0).toUpperCase()}${attr.slice(1)}`;
}

/** 从覆盖键提取该 descendant 上某属性的 StyleValue。 */
function overrideStyleValue(
  patch: Record<string, unknown> | undefined,
  attr: string,
  role: CodeNodeRole,
): StyleValue | undefined {
  if (!patch) {
    return undefined;
  }
  if (attr === 'fills' || attr === 'fill') {
    const fills = asArray<SerializedFillLayerItem>(patch.fills);
    if (role === 'image')
      return (
        primaryImageFromLayers(fills) ?? toStyleValue(patch.fill as string)
      );
    const gradient = singleCssGradientFill(fills);
    return (
      (gradient ? { literal: gradient } : undefined) ??
      primaryColorFromLayers(fills) ??
      toStyleValue(patch.fill as string)
    );
  }
  if (attr === 'strokes' || attr === 'stroke') {
    const strokes = asArray<SerializedFillLayerItem>(patch.strokes);
    return (
      primaryColorFromLayers(strokes) ?? toStyleValue(patch.stroke as string)
    );
  }
  if (attr === 'padding' || attr === 'margin') {
    const box = normalizeBox(patch[attr] as number | number[] | undefined);
    return box ? { literal: boxToCss(box) } : undefined;
  }
  if (attr === 'blendMode') {
    return {
      literal: toCSSMixBlendMode(patch.blendMode as never) ?? 'normal',
    };
  }
  if (attr === 'visibility') {
    return {
      literal:
        patch.visibility === 'inherited'
          ? 'inherit'
          : (patch.visibility as string),
    };
  }
  if (attr === 'fontKerning') {
    return { literal: patch.fontKerning === false ? 'none' : 'normal' };
  }
  return toStyleValue(patch[attr] as string | number);
}

/** 从模板节点取某属性的默认 StyleValue。 */
function templateDefaultValue(
  template: AnyNode,
  descId: string,
  attr: string,
  byId: Map<string, AnyNode>,
): StyleValue | undefined {
  const desc = byId.get(descId);
  if (!desc) {
    return undefined;
  }
  if (attr === 'content') {
    return (
      toStyleValue((desc as TextSerializedNode).content) ?? { literal: '' }
    );
  }
  if (attr === 'opacity') {
    return toStyleValue(desc.opacity as number) ?? { literal: 1 };
  }
  if (attr === 'visibility') {
    return {
      literal:
        desc.visibility === 'hidden' || desc.visibility === 'visible'
          ? desc.visibility
          : 'inherit',
    };
  }
  if (attr === 'blendMode') {
    return {
      literal: toCSSMixBlendMode(desc.blendMode as never) ?? 'normal',
    };
  }
  if (attr === 'flexDirection') {
    return toStyleValue(desc.flexDirection as string) ?? { literal: 'row' };
  }
  if (attr === 'alignItems') {
    return toStyleValue(desc.alignItems as string) ?? { literal: 'stretch' };
  }
  if (attr === 'justifyContent') {
    return (
      toStyleValue(desc.justifyContent as string) ?? { literal: 'flex-start' }
    );
  }
  if (attr === 'flexWrap') {
    return toStyleValue(desc.flexWrap as string) ?? { literal: 'nowrap' };
  }
  if (attr === 'alignSelf') {
    return toStyleValue(desc.alignSelf as string) ?? { literal: 'auto' };
  }
  if (attr === 'flexGrow') {
    return toStyleValue(desc.flexGrow as number) ?? { literal: 0 };
  }
  if (attr === 'flexShrink') {
    return toStyleValue(desc.flexShrink as number) ?? { literal: 0 };
  }
  if (attr === 'flexBasis') {
    return toStyleValue(desc.flexBasis as number) ?? { literal: 'auto' };
  }
  if (attr === 'minWidth' || attr === 'minHeight') {
    return toStyleValue(desc[attr] as number) ?? { literal: 'auto' };
  }
  if (attr === 'maxWidth' || attr === 'maxHeight') {
    return toStyleValue(desc[attr] as number) ?? { literal: 'none' };
  }
  if (attr === 'fontWeight') {
    return toStyleValue(desc.fontWeight as string | number) ?? { literal: 400 };
  }
  if (attr === 'fontStyle') {
    return toStyleValue(desc.fontStyle as string) ?? { literal: 'normal' };
  }
  if (attr === 'fontVariant') {
    return toStyleValue(desc.fontVariant as string) ?? { literal: 'normal' };
  }
  if (attr === 'fontKerning') {
    return { literal: desc.fontKerning === false ? 'none' : 'normal' };
  }
  if (attr === 'wordWrapWidth') {
    return toStyleValue(desc.wordWrapWidth as number) ?? { literal: 0 };
  }
  if (attr === 'fontFamily' || attr === 'textAlign') {
    return toStyleValue(desc[attr] as string) ?? { literal: 'inherit' };
  }
  if (attr === 'letterSpacing') {
    return (
      toStyleValue(desc.letterSpacing as string | number) ?? {
        literal: 'normal',
      }
    );
  }
  if (attr === 'padding' || attr === 'margin') {
    const box = normalizeBox(desc[attr] as number | number[] | undefined);
    return { literal: box ? boxToCss(box) : '0px' };
  }
  if (attr === 'fills' || attr === 'fill') {
    const fills = asArray<SerializedFillLayerItem>(desc.fills);
    const gradient = singleCssGradientFill(fills);
    return (
      primaryImageFromLayers(fills) ??
      (gradient ? { literal: gradient } : undefined) ??
      primaryColorFromLayers(fills) ?? { literal: '#000000' }
    );
  }
  if (attr === 'strokes' || attr === 'stroke') {
    return (
      primaryColorFromLayers(asArray<SerializedFillLayerItem>(desc.strokes)) ??
      toStyleValue(desc.stroke as string) ?? { literal: '#000000' }
    );
  }
  return toStyleValue(desc[attr] as string | number) ?? { literal: 0 };
}

function collectSubtree(
  rootId: string,
  byId: Map<string, AnyNode>,
): Set<string> {
  const ids = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of byId.values()) {
      if (n.parentId && ids.has(n.parentId) && !ids.has(n.id)) {
        ids.add(n.id);
        changed = true;
      }
    }
  }
  return ids;
}

/**
 * 构建代码 IR。
 *
 * @param nodes `.ic` 节点（如 `api.getNodes()`）。
 * @param options 见 {@link CodegenOptions}。
 */
export function buildCodeIR(
  nodes: SerializedNode[],
  options: CodegenOptions = {},
): CodeIR {
  const variablesMode: CodeVariablesMode = options.variablesMode ?? 'resolved';
  const componentStructure = options.componentStructure ?? 'preserve';
  const variables: DesignVariablesMap = options.variables ?? {};
  const themeMode: ThemeMode | undefined = options.themeMode;

  // resolved 模式：先把 $token 解析为字面量，后续 StyleValue 都是 literal
  let working: SerializedNode[] = nodes;
  if (variablesMode === 'resolved') {
    working = resolveSerializedNodesDesignVariables(
      nodes,
      variables,
      themeMode,
    );
  } else if (variablesMode === 'css-var') {
    working = resolveSerializedNodesTextVariables(nodes, variables, themeMode);
  }

  if (
    componentStructure === 'flatten' ||
    hasUnsupportedPaintRefOverrides(working as AnyNode[]) ||
    hasUnsupportedTransformRefOverrides(working as AnyNode[]) ||
    hasUnsupportedClipRefOverrides(working as AnyNode[]) ||
    hasUnsupportedFreeLayoutRefOverrides(working as AnyNode[]) ||
    hasUnsupportedVectorRefOverrides(working as AnyNode[]) ||
    hasUnsupportedTextWrapRefOverrides(working as AnyNode[])
  ) {
    const expanded = expandRefSerializedNodes(working, working);
    const roots = buildRootsExcludingReusable(
      expanded as AnyNode[],
      options.semanticElements ?? {},
      variablesMode,
    );
    return {
      components: [],
      roots,
      rootFrame: positionSceneRoots(roots, expanded as AnyNode[]),
      variables,
      themeMode,
      variablesMode,
    };
  }

  return buildPreserve(
    working as AnyNode[],
    variables,
    themeMode,
    variablesMode,
    options.semanticElements ?? {},
  );
}

/** 由扁平节点表构建顶层树，跳过 `reusable` 模板根（flatten 模式仍保留实例展开结果）。 */
function buildRootsExcludingReusable(
  nodes: AnyNode[],
  semanticElements: Record<string, CodeSemanticElement>,
  variablesMode: CodeVariablesMode,
): CodeNode[] {
  const byId = new Map<string, AnyNode>(nodes.map((n) => [n.id, n]));
  const childrenByParent = new Map<string | undefined, AnyNode[]>();
  for (const n of nodes) {
    const arr = childrenByParent.get(n.parentId) ?? [];
    arr.push(n);
    childrenByParent.set(n.parentId, arr);
  }
  const ctx: BuildContext = {
    childrenByParent,
    semanticElements,
    byId,
    templateToComponentName: new Map(),
    overridesByTemplate: new Map(),
    variablesMode,
  };
  const roots = sortChildren(
    nodes.filter((n) => !n.parentId || !byId.has(n.parentId)),
  ).filter((n) => !n.reusable);
  return roots.map((n) => buildCodeNode(n, ctx));
}

/** Keep spacing between scene roots when all have a measurable frame. */
function positionSceneRoots(
  roots: CodeNode[],
  nodes: AnyNode[],
): CodeIR['rootFrame'] {
  if (roots.length < 2) return undefined;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const frames = roots.map((root) => {
    const node = byId.get(root.id);
    const template = node?.type === 'ref' ? byId.get(node.ref as string) : null;
    const x = node?.x;
    const y = node?.y;
    const width = node?.width ?? template?.width;
    const height = node?.height ?? template?.height;
    const rotation = node?.rotation ?? template?.rotation ?? 0;
    const scaleX = node?.scaleX ?? template?.scaleX ?? 1;
    const scaleY = node?.scaleY ?? template?.scaleY ?? 1;
    if (
      ![x, y, width, height, rotation, scaleX, scaleY].every(
        (value) => typeof value === 'number' && Number.isFinite(value),
      ) ||
      (width as number) <= 0 ||
      (height as number) <= 0
    )
      return undefined;
    return {
      x: x as number,
      y: y as number,
      width: width as number,
      height: height as number,
      rotation: rotation as number,
      scaleX: scaleX as number,
      scaleY: scaleY as number,
    };
  });
  if (frames.some((frame) => !frame)) return undefined;
  const sized = frames as Array<NonNullable<(typeof frames)[number]>>;
  // CSS `rotate(...) scale(...)` around 0 0 matches the canvas local transform.
  const corners = sized.flatMap((frame) => {
    const cos = Math.cos(frame.rotation);
    const sin = Math.sin(frame.rotation);
    return [
      [0, 0],
      [frame.width, 0],
      [0, frame.height],
      [frame.width, frame.height],
    ].map(([x, y]) => ({
      x: frame.x + cos * frame.scaleX * x - sin * frame.scaleY * y,
      y: frame.y + sin * frame.scaleX * x + cos * frame.scaleY * y,
    }));
  });
  // Round outward so CSS transform serialization cannot clip a subpixel edge.
  const minX = Math.floor(Math.min(...corners.map((corner) => corner.x)));
  const minY = Math.floor(Math.min(...corners.map((corner) => corner.y)));
  const maxX = Math.ceil(Math.max(...corners.map((corner) => corner.x)));
  const maxY = Math.ceil(Math.max(...corners.map((corner) => corner.y)));
  roots.forEach((root, index) => {
    root.style.position = 'absolute';
    root.style.left = sized[index].x - minX;
    root.style.top = sized[index].y - minY;
  });
  return { width: maxX - minX, height: maxY - minY };
}

function buildPreserve(
  nodes: AnyNode[],
  variables: DesignVariablesMap,
  themeMode: ThemeMode | undefined,
  variablesMode: CodeVariablesMode,
  semanticElements: Record<string, CodeSemanticElement>,
): CodeIR {
  const byId = new Map<string, AnyNode>(nodes.map((n) => [n.id, n]));
  const childrenByParent = new Map<string | undefined, AnyNode[]>();
  for (const n of nodes) {
    const arr = childrenByParent.get(n.parentId) ?? [];
    arr.push(n);
    childrenByParent.set(n.parentId, arr);
  }

  // 1) 收集各模板被实例覆盖的属性键，用来推断 props
  const overridesByTemplate = new Map<string, Set<string>>();
  for (const n of nodes) {
    if (n.type !== 'ref') {
      continue;
    }
    const refn = n as RefSerializedNode & {
      descendants?: Record<string, Record<string, unknown>>;
    };
    const templateId = refn.ref;
    if (!templateId || !byId.has(templateId)) {
      continue;
    }
    const set = overridesByTemplate.get(templateId) ?? new Set<string>();
    // 实例根的内联覆盖映射到模板根
    for (const attr of Object.keys(n)) {
      if (
        ['id', 'type', 'parentId', 'ref', 'reusable', 'descendants'].includes(
          attr,
        )
      ) {
        continue;
      }
      if (SHADOW_KEYS.has(attr)) {
        set.add(`${templateId}::dropShadow`);
        continue;
      }
      if (DECORATION_KEYS.has(attr)) {
        set.add(`${templateId}::textDecoration`);
        continue;
      }
      if (
        attr in OVERRIDABLE_KEY_TO_TARGET ||
        attr === 'fills' ||
        attr === 'fill' ||
        attr === 'strokes' ||
        attr === 'stroke'
      ) {
        set.add(`${templateId}::${attr}`);
      }
    }
    const descendants = refn.descendants ?? {};
    for (const [descId, patch] of Object.entries(descendants)) {
      for (const attr of Object.keys(patch)) {
        if (SHADOW_KEYS.has(attr)) {
          set.add(`${descId}::dropShadow`);
          continue;
        }
        if (DECORATION_KEYS.has(attr)) {
          set.add(`${descId}::textDecoration`);
          continue;
        }
        if (
          attr in OVERRIDABLE_KEY_TO_TARGET ||
          attr === 'fills' ||
          attr === 'fill' ||
          attr === 'strokes' ||
          attr === 'stroke'
        ) {
          set.add(`${descId}::${attr}`);
        }
      }
    }
    overridesByTemplate.set(templateId, set);
  }

  // 2) 先分配所有模板名，嵌套在普通容器中的 ref 才能解析为组件调用。
  const usedNames = new Set<string>();
  const templateToComponentName = new Map<string, string>();
  for (const n of nodes) {
    if (!n.reusable) {
      continue;
    }
    let name = toComponentName(
      typeof n.name === 'string' ? n.name : undefined,
      n.id,
    );
    while (usedNames.has(name)) {
      name = `${name}_`;
    }
    usedNames.add(name);
    templateToComponentName.set(n.id, name);
  }

  const ctx: BuildContext = {
    childrenByParent,
    semanticElements,
    byId,
    templateToComponentName,
    overridesByTemplate,
    variablesMode,
  };
  const components: CodeComponentDef[] = [];
  for (const n of nodes) {
    if (!n.reusable) continue;
    const name = templateToComponentName.get(n.id)!;

    const bindings = overridesByTemplate.get(n.id) ?? new Set<string>();
    const root = buildCodeNode(n, ctx, bindings);
    const props = buildComponentProps(n, bindings, byId, variablesMode);
    components.push({ name, templateId: n.id, root, props });
  }

  // 3) 顶层树：reusable 模板根与其子树不直接渲染；ref 实例 → 组件调用
  const reusableSubtreeIds = new Set<string>();
  for (const n of nodes) {
    if (n.reusable) {
      for (const id of collectSubtree(n.id, byId)) {
        reusableSubtreeIds.add(id);
      }
    }
  }

  const topLevel = sortChildren(
    nodes.filter((n) => {
      if (n.parentId && byId.has(n.parentId)) {
        return false;
      }
      if (n.reusable) {
        return false;
      }
      return true;
    }),
  );

  const roots: CodeNode[] = [];
  for (const n of topLevel) {
    if (n.type === 'ref') {
      const instance = buildInstanceNode(
        n as RefSerializedNode & {
          descendants?: Record<string, Record<string, unknown>>;
        },
        templateToComponentName,
        byId,
        variablesMode,
      );
      if (instance) {
        roots.push(instance);
        continue;
      }
    }
    if (reusableSubtreeIds.has(n.id)) {
      continue;
    }
    roots.push(buildCodeNode(n, ctx));
  }

  return {
    components,
    roots,
    rootFrame: positionSceneRoots(roots, nodes),
    variables,
    themeMode,
    variablesMode,
  };
}

function hasUnsupportedPaintRefOverrides(nodes: AnyNode[]): boolean {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return nodes.some((node) => {
    if (node.type !== 'ref') return false;
    const template = byId.get(node.ref as string);
    if (!template) return false;
    if (
      'fills' in node &&
      hasUnsupportedPaintFillOverride(
        template.fills,
        node.fills,
        decideRole(template) === 'container' || template.type === 'ellipse',
      )
    )
      return true;
    const descendants = node.descendants as
      | Record<string, Record<string, unknown>>
      | undefined;
    return Object.entries(descendants ?? {}).some(([id, patch]) => {
      const child = byId.get(id);
      return (
        child &&
        'fills' in patch &&
        hasUnsupportedPaintFillOverride(
          child.fills,
          patch.fills,
          decideRole(child) === 'container' || child.type === 'ellipse',
        )
      );
    });
  });
}

/** Transform changes need a complete instance body; a style prop alone misses the root. */
function hasUnsupportedTransformRefOverrides(nodes: AnyNode[]): boolean {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const changed = (template: AnyNode | undefined, patch: AnyNode) =>
    !!template &&
    (['rotation', 'scaleX', 'scaleY'] as const).some(
      (key) =>
        key in patch &&
        !Object.is(patch[key], template[key] ?? (key === 'rotation' ? 0 : 1)),
    );
  return nodes.some((node) => {
    if (node.type !== 'ref') return false;
    if (changed(byId.get(node.ref as string), node)) return true;
    return Object.entries(
      (node.descendants ?? {}) as Record<string, AnyNode>,
    ).some(([id, patch]) => changed(byId.get(id), patch));
  });
}

/** A clip change alters descendant visibility and cannot be represented by a paint prop. */
function hasUnsupportedClipRefOverrides(nodes: AnyNode[]): boolean {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const changed = (template: AnyNode | undefined, patch: AnyNode) =>
    !!template && 'clipMode' in patch && patch.clipMode !== template.clipMode;
  return nodes.some((node) => {
    if (node.type !== 'ref') return false;
    if (changed(byId.get(node.ref as string), node)) return true;
    return Object.entries(
      (node.descendants ?? {}) as Record<string, AnyNode>,
    ).some(([id, patch]) => changed(byId.get(id), patch));
  });
}

/** Template child coordinates and display mode cannot be changed by current style props. */
function hasUnsupportedFreeLayoutRefOverrides(nodes: AnyNode[]): boolean {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const displayChanged = (template: AnyNode | undefined, patch: AnyNode) =>
    !!template && 'display' in patch && patch.display !== template.display;
  return nodes.some((node) => {
    if (node.type !== 'ref') return false;
    if (displayChanged(byId.get(node.ref as string), node)) return true;
    return Object.entries(
      (node.descendants ?? {}) as Record<string, AnyNode>,
    ).some(([id, patch]) => {
      const template = byId.get(id);
      if (!template) return false;
      if (displayChanged(template, patch)) return true;
      const parent = byId.get(template.parentId as string);
      return (
        !!parent &&
        parent.display !== 'flex' &&
        (('x' in patch && patch.x !== template.x) ||
          ('y' in patch && patch.y !== template.y))
      );
    });
  });
}

/** Vector paint and geometry edits need an expanded SVG, not a CSS box prop. */
function hasUnsupportedVectorRefOverrides(nodes: AnyNode[]): boolean {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const keys = [
    'd',
    'points',
    'x1',
    'y1',
    'x2',
    'y2',
    'fills',
    'fill',
    'fillRule',
    'strokes',
    'stroke',
    'strokeWidth',
    'strokeLinecap',
    'strokeLinejoin',
    'strokeMiterlimit',
    'strokeDasharray',
    'strokeDashoffset',
    'strokeAlignment',
    ...SHADOW_KEYS,
    'markerStart',
    'markerEnd',
    'markerFactor',
  ];
  const changed = (template: AnyNode | undefined, patch: AnyNode) =>
    ['path', 'line', 'polyline'].includes(template?.type as string) &&
    keys.some((key) => key in patch);
  return nodes.some((node) => {
    if (node.type !== 'ref') return false;
    if (changed(byId.get(node.ref as string), node)) return true;
    return Object.entries(
      (node.descendants ?? {}) as Record<string, AnyNode>,
    ).some(([id, patch]) => changed(byId.get(id), patch));
  });
}

/** `wordWrap` changes the element's layout mode, so a width-only prop cannot express it. */
function hasUnsupportedTextWrapRefOverrides(nodes: AnyNode[]): boolean {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const unsupported = (template: AnyNode | undefined, patch: AnyNode) =>
    !!template &&
    ('wordWrap' in patch ||
      'maxLines' in patch ||
      'textOverflow' in patch ||
      ('wordWrapWidth' in patch &&
        (template.wordWrap !== true ||
          typeof template.wordWrapWidth !== 'number' ||
          template.wordWrapWidth <= 0)));
  return nodes.some((node) => {
    if (node.type !== 'ref') return false;
    if (unsupported(byId.get(node.ref as string), node)) return true;
    return Object.entries(
      (node.descendants ?? {}) as Record<string, AnyNode>,
    ).some(([id, patch]) => unsupported(byId.get(id), patch));
  });
}

function buildComponentProps(
  template: AnyNode,
  bindings: Set<string>,
  byId: Map<string, AnyNode>,
  variablesMode: CodeVariablesMode,
): CodeComponentProp[] {
  const props: CodeComponentProp[] = [];
  const seen = new Set<string>();
  for (const key of bindings) {
    const [descId, attr] = key.split('::');
    const desc = byId.get(descId);
    if (!desc) {
      continue;
    }
    const role = decideRole(desc);
    const target =
      OVERRIDABLE_KEY_TO_TARGET[attr] ?? colorTargetFor(attr, role, desc);
    if (!target) {
      continue;
    }
    const name = propNameFor(desc, attr);
    if (seen.has(name)) {
      continue;
    }
    seen.add(name);
    props.push({
      name,
      target,
      defaultValue:
        attr === 'dropShadow'
          ? shadowStyleValue(desc, undefined, variablesMode)
          : attr === 'textDecoration'
          ? textDecorationStyleValue(desc, undefined, variablesMode)
          : templateDefaultValue(template, descId, attr, byId) ?? {
              literal: '',
            },
    });
  }
  return props;
}

function buildInstanceNode(
  refn: RefSerializedNode & {
    descendants?: Record<string, Record<string, unknown>>;
  },
  templateToComponentName: Map<string, string>,
  byId: Map<string, AnyNode>,
  variablesMode: CodeVariablesMode,
): CodeNode | undefined {
  const componentName = templateToComponentName.get(refn.ref);
  if (!componentName) {
    return undefined;
  }
  const props: Record<string, StyleValue> = {};
  const descendants = refn.descendants ?? {};
  const desc = byId.get(refn.ref);

  // 实例根内联覆盖 → 根 descendant 的 props
  const rootPatch: Record<string, unknown> = {};
  const refnRecord = refn as unknown as Record<string, unknown>;
  for (const attr of Object.keys(refn)) {
    if (
      ['id', 'type', 'parentId', 'ref', 'reusable', 'descendants'].includes(
        attr,
      )
    ) {
      continue;
    }
    rootPatch[attr] = refnRecord[attr];
  }

  const collectFrom = (descId: string, patch: Record<string, unknown>) => {
    const descNode = byId.get(descId);
    if (descNode && Object.keys(patch).some((key) => SHADOW_KEYS.has(key))) {
      props[propNameFor(descNode, 'dropShadow')] = shadowStyleValue(
        descNode,
        patch,
        variablesMode,
      );
    }
    if (
      descNode &&
      Object.keys(patch).some((key) => DECORATION_KEYS.has(key))
    ) {
      props[propNameFor(descNode, 'textDecoration')] = textDecorationStyleValue(
        descNode,
        patch,
        variablesMode,
      );
    }
    for (const attr of Object.keys(patch)) {
      if (
        !(attr in OVERRIDABLE_KEY_TO_TARGET) &&
        attr !== 'fills' &&
        attr !== 'fill' &&
        attr !== 'strokes' &&
        attr !== 'stroke'
      ) {
        continue;
      }
      const sv = overrideStyleValue(
        patch,
        attr,
        descNode ? decideRole(descNode) : 'shape',
      );
      if (sv && descNode) {
        props[propNameFor(descNode, attr)] = sv;
      }
    }
  };

  if (desc) {
    collectFrom(refn.ref, rootPatch);
  }
  for (const [descId, patch] of Object.entries(descendants)) {
    collectFrom(descId, patch);
  }

  return {
    role: 'container',
    id: refn.id,
    name: typeof refn.name === 'string' ? refn.name : undefined,
    style: {},
    children: [],
    instanceOf: componentName,
    props,
  };
}
