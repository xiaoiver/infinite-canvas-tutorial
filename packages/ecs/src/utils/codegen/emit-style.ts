/**
 * emitter 共用的样式输出助手：把 {@link StyleValue} / {@link StyleIR} 按变量模式转为
 * CSS 字面量、`var(--token)` 或保留的 `$token`。
 */
import { designTokenKeyToCssCustomProperty } from '../design-variables';
import { formatNumber } from '../serialize/points';
import type { CodeVariablesMode, StyleIR, StyleValue } from './types';

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

function box(v: [number, number, number, number]): string {
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
  if (style.flexGrow !== undefined)
    push('flex-grow', formatNumber(style.flexGrow));
  if (style.flexShrink !== undefined)
    push('flex-shrink', formatNumber(style.flexShrink));

  if (style.padding) push('padding', box(style.padding));
  if (style.margin) push('margin', box(style.margin));

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

  if (style.backgroundColor)
    push('background-color', styleValueToCss(style.backgroundColor, mode));
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
  if (style.opacity !== undefined) push('opacity', formatNumber(style.opacity));

  if (style.color) push('color', styleValueToCss(style.color, mode));
  if (style.fontSize)
    push('font-size', styleValueToCss(style.fontSize, mode, true));
  if (style.fontWeight !== undefined)
    push('font-weight', String(style.fontWeight));
  if (style.fontStyle) push('font-style', style.fontStyle);
  if (style.fontFamily) push('font-family', style.fontFamily);
  if (style.textAlign) push('text-align', style.textAlign);
  if (style.letterSpacing)
    push('letter-spacing', styleValueToCss(style.letterSpacing, mode, true));
  if (style.lineHeight)
    push('line-height', styleValueToCss(style.lineHeight, mode, true));

  return out;
}

/** CSS 属性名（kebab-case）→ React style 对象键（camelCase）。 */
export function cssPropToReactKey(prop: string): string {
  return prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}
