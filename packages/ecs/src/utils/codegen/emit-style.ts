/**
 * emitter 共用的样式输出助手：把 {@link StyleValue} / {@link StyleIR} 按变量模式转为
 * CSS 字面量、`var(--token)` 或保留的 `$token`。
 */
import { designTokenKeyToCssCustomProperty } from '../design-variables';
import { formatNumber } from '../serialize/points';
import type { CodeNode, CodeVariablesMode, StyleIR, StyleValue } from './types';

/** 把一个 {@link StyleValue} 渲染为 CSS 值字符串。`px` 决定数字字面量是否补 `px`。 */
export function styleValueToCss(
  value: StyleValue,
  mode: CodeVariablesMode,
  px = false,
): string {
  if (value.token) {
    if (mode === 'css-var') {
      return `var(${designTokenKeyToCssCustomProperty(value.token)})`;
    }
    // preserve-token：保留 $token（非标准，便于再加工）
    return `$${value.token}`;
  }
  const lit = value.literal;
  if (typeof lit === 'number') {
    return px ? `${formatNumber(lit)}px` : formatNumber(lit);
  }
  return String(lit ?? '');
}

/** Keep fill opacity on the paint, so text and child elements stay opaque. */
export function solidFillColorToCss(
  color: StyleValue,
  opacity: StyleValue | undefined,
  mode: CodeVariablesMode,
): string {
  const cssColor = styleValueToCss(color, mode);
  if (!opacity) return cssColor;
  const literal = Number(opacity.literal);
  const weight =
    opacity.token || !Number.isFinite(literal)
      ? `calc(${styleValueToCss(opacity, mode)} * 100%)`
      : `${formatNumber(literal * 100)}%`;
  return `color-mix(in srgb, ${cssColor} ${weight}, transparent)`;
}

/** CSS background images are listed top-first; canvas fill layers are bottom-first. */
export function paintBackgroundUrlToCss(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\n\r\f]/g, '\\A ');
  return `url("${escaped}")`;
}

export function paintBackgroundLayersToCss(
  style: StyleIR,
  mode: CodeVariablesMode,
): string | undefined {
  if (!style.backgroundLayers?.length) return undefined;
  return [...style.backgroundLayers]
    .reverse()
    .map((layer) => {
      if (layer.type === 'gradient') return layer.value;
      if (layer.type === 'image' || layer.type === 'pattern')
        return paintBackgroundUrlToCss(layer.value);
      const color = solidFillColorToCss(layer.color, layer.opacity, mode);
      return `linear-gradient(${color}, ${color})`;
    })
    .join(', ');
}

/** Keep each CSS background aligned with its image fit or pattern tiling. */
export function paintBackgroundLayerLayoutToCss(
  style: StyleIR,
): { size: string; position: string; repeat: string } | undefined {
  if (
    !style.backgroundLayers?.some(
      (layer) => layer.type === 'image' || layer.type === 'pattern',
    )
  )
    return undefined;
  const layers = [...style.backgroundLayers].reverse();
  return {
    size: layers
      .map((layer) => {
        if (layer.type === 'pattern') return 'auto';
        if (
          layer.type !== 'image' ||
          !layer.objectFit ||
          layer.objectFit === 'fill'
        )
          return '100% 100%';
        return layer.objectFit === 'none' ? 'auto' : layer.objectFit;
      })
      .join(', '),
    position: layers
      .map((layer) =>
        layer.type === 'image' ? layer.objectPosition ?? '50% 50%' : '0% 0%',
      )
      .join(', '),
    repeat: layers
      .map((layer) =>
        layer.type === 'pattern' ? layer.repetition ?? 'repeat' : 'no-repeat',
      )
      .join(', '),
  };
}

export function paintBackgroundBlendModesToCss(
  style: StyleIR,
): string | undefined {
  if (!style.backgroundLayers?.some((layer) => layer.blendMode))
    return undefined;
  return [...style.backgroundLayers]
    .reverse()
    .map((layer) => layer.blendMode ?? 'normal')
    .join(', ');
}

export function vectorDropShadowToCss(
  shadow: NonNullable<NonNullable<CodeNode['vectorPath']>['dropShadow']>,
  mode: CodeVariablesMode,
): string {
  return `drop-shadow(${formatNumber(shadow.offsetX)}px ${formatNumber(
    shadow.offsetY,
  )}px ${formatNumber(shadow.blur)}px ${styleValueToCss(shadow.color, mode)})`;
}

export function boxToCss(v: [number, number, number, number]): string {
  const [t, r, b, l] = v;
  if (t === r && r === b && b === l) {
    return `${formatNumber(t)}px`;
  }
  if (t === b && r === l) {
    return `${formatNumber(t)}px ${formatNumber(r)}px`;
  }
  return `${formatNumber(t)}px ${formatNumber(r)}px ${formatNumber(
    b,
  )}px ${formatNumber(l)}px`;
}

/** A single image fill and its node share one `<img>` opacity in generated code. */
export function combinedImageOpacityCss(
  style: StyleIR,
  mode: CodeVariablesMode,
): string | undefined {
  const fill = style.imageFillOpacity;
  if (!fill)
    return style.opacity === undefined
      ? undefined
      : formatNumber(style.opacity);
  if (typeof fill.literal === 'number')
    return formatNumber((style.opacity ?? 1) * fill.literal);
  const fillCss = styleValueToCss(fill, mode);
  return style.opacity === undefined
    ? fillCss
    : `calc(${formatNumber(style.opacity)} * ${fillCss})`;
}

export function textDecorationToCss(
  decoration: NonNullable<StyleIR['textDecoration']>,
  mode: CodeVariablesMode,
): string {
  return `${decoration.style} ${decoration.line} ${styleValueToCss(
    decoration.color,
    mode,
  )} ${formatNumber(decoration.thickness)}px`;
}

/**
 * 把 {@link StyleIR} 转为 CSS 属性键值对（键为 kebab-case CSS 属性名）。
 * 供 HTML/CSS emitter 直接使用，也是 React inline style 的基础。
 */
export function styleIRToCssDeclarations(
  style: StyleIR,
  mode: CodeVariablesMode,
): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const push = (k: string, v: string) => out.push([k, v]);

  if (style.display === 'flex') {
    push('display', 'flex');
    if (style.flexDirection) push('flex-direction', style.flexDirection);
    if (style.alignItems) push('align-items', style.alignItems);
    if (style.justifyContent) push('justify-content', style.justifyContent);
    if (style.flexWrap) push('flex-wrap', style.flexWrap);
    if (style.gap !== undefined) push('gap', `${formatNumber(style.gap)}px`);
    if (style.rowGap !== undefined)
      push('row-gap', `${formatNumber(style.rowGap)}px`);
    if (style.columnGap !== undefined)
      push('column-gap', `${formatNumber(style.columnGap)}px`);
  }
  if (style.display === 'inline-block') push('display', 'inline-block');
  if (style.position) push('position', style.position);
  if (style.left !== undefined) push('left', `${formatNumber(style.left)}px`);
  if (style.top !== undefined) push('top', `${formatNumber(style.top)}px`);
  if (style.flexGrow !== undefined)
    push('flex-grow', formatNumber(style.flexGrow));
  if (style.flexShrink !== undefined)
    push('flex-shrink', formatNumber(style.flexShrink));
  if (style.flexBasis !== undefined)
    push('flex-basis', `${formatNumber(style.flexBasis)}px`);
  if (style.alignSelf) push('align-self', style.alignSelf);

  if (style.padding) push('padding', boxToCss(style.padding));
  if (style.margin) push('margin', boxToCss(style.margin));

  if (style.width !== undefined)
    push('width', `${formatNumber(style.width)}px`);
  if (style.height !== undefined)
    push('height', `${formatNumber(style.height)}px`);
  if (style.minWidth !== undefined)
    push('min-width', `${formatNumber(style.minWidth)}px`);
  if (style.maxWidth !== undefined)
    push('max-width', `${formatNumber(style.maxWidth)}px`);
  if (style.minHeight !== undefined)
    push('min-height', `${formatNumber(style.minHeight)}px`);
  if (style.maxHeight !== undefined)
    push('max-height', `${formatNumber(style.maxHeight)}px`);
  if (style.transform) {
    push('transform', style.transform);
    push('transform-origin', '0 0');
  }
  if (style.overflow) push('overflow', style.overflow);
  if (style.isolation) push('isolation', style.isolation);
  if (style.objectFit) push('object-fit', style.objectFit);
  if (style.objectPosition) push('object-position', style.objectPosition);
  if (style.mixBlendMode) push('mix-blend-mode', style.mixBlendMode);

  if (style.backgroundColor)
    push(
      'background-color',
      solidFillColorToCss(style.backgroundColor, style.solidFillOpacity, mode),
    );
  const backgroundLayers = paintBackgroundLayersToCss(style, mode);
  if (backgroundLayers) push('background-image', backgroundLayers);
  else if (style.backgroundImage)
    push('background-image', styleValueToCss(style.backgroundImage, mode));
  const backgroundLayout = paintBackgroundLayerLayoutToCss(style);
  if (backgroundLayout) {
    push('background-size', backgroundLayout.size);
    push('background-position', backgroundLayout.position);
    push('background-repeat', backgroundLayout.repeat);
  }
  const backgroundBlendModes = paintBackgroundBlendModesToCss(style);
  if (backgroundBlendModes) push('background-blend-mode', backgroundBlendModes);
  if (style.borderRadius)
    push('border-radius', styleValueToCss(style.borderRadius, mode, true));
  if (style.borderWidth) {
    const w = styleValueToCss(style.borderWidth, mode, true);
    const c = style.borderColor
      ? styleValueToCss(style.borderColor, mode)
      : '#000000';
    push('border', `${w} solid ${c}`);
  }
  if (style.boxShadow) {
    const s = style.boxShadow;
    push(
      'box-shadow',
      `${formatNumber(s.offsetX)}px ${formatNumber(s.offsetY)}px ${formatNumber(
        s.blur,
      )}px ${styleValueToCss(s.color, mode)}`,
    );
  }
  const opacity = combinedImageOpacityCss(style, mode);
  if (opacity !== undefined) push('opacity', opacity);
  if (style.visibility) push('visibility', style.visibility);

  if (style.color)
    push(
      'color',
      solidFillColorToCss(style.color, style.solidFillOpacity, mode),
    );
  if (style.fontSize)
    push('font-size', styleValueToCss(style.fontSize, mode, true));
  if (style.fontWeight !== undefined)
    push('font-weight', String(style.fontWeight));
  if (style.fontStyle) push('font-style', style.fontStyle);
  if (style.fontVariant) push('font-variant', style.fontVariant);
  if (style.fontKerning) push('font-kerning', style.fontKerning);
  if (style.fontFamily) push('font-family', style.fontFamily);
  if (style.textAlign) push('text-align', style.textAlign);
  if (style.whiteSpace) push('white-space', style.whiteSpace);
  if (style.textWrapWidth !== undefined) {
    if (style.display !== 'inline-block') push('display', 'inline-block');
    push('overflow-wrap', 'anywhere');
    push('max-width', `${formatNumber(style.textWrapWidth)}px`);
  }
  if (style.maxLines !== undefined && style.textOverflow === 'ellipsis') {
    push('display', '-webkit-box');
    push('-webkit-box-orient', 'vertical');
    push('-webkit-line-clamp', String(style.maxLines));
    push('overflow', 'hidden');
  } else if (style.maxLines !== undefined && style.textOverflow === 'clip') {
    push('max-height', `calc(${style.maxLines} * 1lh)`);
    push('overflow', 'hidden');
  }
  if (style.letterSpacing)
    push('letter-spacing', styleValueToCss(style.letterSpacing, mode, true));
  if (style.lineHeight)
    push('line-height', styleValueToCss(style.lineHeight, mode, true));
  else if (style.lineHeightRatio !== undefined)
    push('line-height', formatNumber(style.lineHeightRatio));
  if (style.textDecoration)
    push('text-decoration', textDecorationToCss(style.textDecoration, mode));

  return out;
}

/** CSS 属性名（kebab-case）→ React style 对象键（camelCase）。 */
export function cssPropToReactKey(prop: string): string {
  return prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}
