/**
 * Code IR → React + Tailwind 代码字符串。
 *
 * - 布局/间距/排版 → Tailwind 工具类（必要时用 arbitrary value 语法，如 `gap-[10px]`）；
 * - 颜色/圆角等设计变量：`css-var` 模式输出 `bg-[var(--token)]`；`preserve-token` 模式回退为
 *   inline style 中保留 `$token`；`resolved` 模式输出字面量；
 * - `iconfont` → `lucide-react`（lucide 族）或 `@iconify/react`（其他族）；
 * - `reusable` → 函数组件定义，`ref` 实例 → 组件调用并以 props 传入覆盖项。
 * - `css-var` 模式在顶层组件中输出局部变量定义，使其可直接渲染且不会覆盖其他导出组件。
 */
import { formatNumber } from '../serialize/points';
import { buildDesignVariablesCssRootBlock } from '../design-variables';
import { renderVectorSvg } from './render-vector-svg';
import { renderVectorImageStrokeOverlay } from './render-vector-image-stroke-overlay';
import { renderVectorMixedStrokes } from './render-vector-mixed-strokes';
import { renderPaintOverlays } from './emit-paint-overlays';
import { pascalCase } from './string-utils';
import {
  combinedImageOpacityCss,
  paintBackgroundLayersToCss,
  paintBackgroundLayerLayoutToCss,
  paintBackgroundBlendModesToCss,
  solidFillColorToCss,
  styleValueToCss,
  textDecorationToCss,
} from './emit-style';
import type {
  CodeBindingTarget,
  CodeComponentDef,
  CodeIR,
  CodeNode,
  CodeVariablesMode,
  StyleIR,
  StyleValue,
} from './types';

const TARGET_TO_CSS_KEY: Record<CodeBindingTarget, string> = {
  text: 'content',
  imageSrc: 'src',
  mixBlendMode: 'mixBlendMode',
  backgroundColor: 'backgroundColor',
  backgroundImage: 'backgroundImage',
  color: 'color',
  fontSize: 'fontSize',
  borderRadius: 'borderRadius',
  width: 'width',
  height: 'height',
  borderWidth: 'borderWidth',
  borderColor: 'borderColor',
  opacity: 'opacity',
  visibility: 'visibility',
  fontWeight: 'fontWeight',
  fontStyle: 'fontStyle',
  fontVariant: 'fontVariant',
  fontKerning: 'fontKerning',
  fontFamily: 'fontFamily',
  textAlign: 'textAlign',
  textWrapWidth: 'maxWidth',
  letterSpacing: 'letterSpacing',
  lineHeight: 'lineHeight',
  textDecoration: 'textDecoration',
  boxShadow: 'boxShadow',
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
  minWidth: 'minWidth',
  maxWidth: 'maxWidth',
  minHeight: 'minHeight',
  maxHeight: 'maxHeight',
};

interface TwResult {
  classes: string[];
  /** preserve-token 模式无法进类名的 token → inline style（值已是 JS 字面量表达式）。 */
  inline: Array<[string, string]>;
}

function variableScopeClass(css: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < css.length; i++) {
    hash = Math.imul(hash ^ css.charCodeAt(i), 0x01000193);
  }
  return `ic-codegen-vars-${(hash >>> 0).toString(36)}`;
}

/** token 在 preserve-token 模式下不能进 arbitrary 类名，需回退 inline。 */
function needsInline(
  sv: StyleValue | undefined,
  mode: CodeVariablesMode,
): boolean {
  return !!sv?.token && mode === 'preserve-token';
}

/** arbitrary value 内不能有空格，用下划线代替（Tailwind 约定）。 */
function tw(raw: string): string {
  return raw.replace(/ /g, '_');
}

function genTailwind(
  style: StyleIR,
  mode: CodeVariablesMode,
  skip: Set<CodeBindingTarget>,
): TwResult {
  const classes: string[] = [];
  const inline: Array<[string, string]> = [];
  const addInline = (key: string, sv: StyleValue) =>
    inline.push([key, JSON.stringify(styleValueToCss(sv, mode))]);

  if (style.display === 'flex') {
    classes.push('flex');
    switch (skip.has('flexDirection') ? undefined : style.flexDirection) {
      case 'row-reverse':
        classes.push('flex-row-reverse');
        break;
      case 'column':
        classes.push('flex-col');
        break;
      case 'column-reverse':
        classes.push('flex-col-reverse');
        break;
      case 'row':
        classes.push('flex-row');
        break;
      default:
        break;
    }
    const align: Record<string, string> = {
      center: 'items-center',
      'flex-start': 'items-start',
      'flex-end': 'items-end',
      stretch: 'items-stretch',
      baseline: 'items-baseline',
    };
    if (!skip.has('alignItems') && style.alignItems && align[style.alignItems])
      classes.push(align[style.alignItems]);
    const justify: Record<string, string> = {
      center: 'justify-center',
      'flex-start': 'justify-start',
      'flex-end': 'justify-end',
      'space-between': 'justify-between',
      'space-around': 'justify-around',
      'space-evenly': 'justify-evenly',
    };
    if (
      !skip.has('justifyContent') &&
      style.justifyContent &&
      justify[style.justifyContent]
    )
      classes.push(justify[style.justifyContent]);
    if (!skip.has('flexWrap') && style.flexWrap === 'wrap')
      classes.push('flex-wrap');
    else if (!skip.has('flexWrap') && style.flexWrap === 'wrap-reverse')
      classes.push('flex-wrap-reverse');
    if (style.gap !== undefined && !skip.has('gap'))
      classes.push(`gap-[${formatNumber(style.gap)}px]`);
    if (style.rowGap !== undefined && !skip.has('rowGap'))
      classes.push(`gap-y-[${formatNumber(style.rowGap)}px]`);
    if (style.columnGap !== undefined && !skip.has('columnGap'))
      classes.push(`gap-x-[${formatNumber(style.columnGap)}px]`);
  }
  if (style.display === 'inline-block') classes.push('inline-block');
  if (style.position) classes.push(style.position);
  if (style.left !== undefined)
    classes.push(`left-[${formatNumber(style.left)}px]`);
  if (style.top !== undefined)
    classes.push(`top-[${formatNumber(style.top)}px]`);
  if (style.flexGrow !== undefined && !skip.has('flexGrow'))
    classes.push(style.flexGrow === 1 ? 'grow' : `grow-[${style.flexGrow}]`);
  if (style.flexShrink === 0 && !skip.has('flexShrink'))
    classes.push('shrink-0');
  if (style.flexBasis !== undefined && !skip.has('flexBasis'))
    classes.push(`basis-[${formatNumber(style.flexBasis)}px]`);
  if (style.alignSelf && !skip.has('alignSelf')) {
    const alignSelf: Record<string, string> = {
      auto: 'self-auto',
      center: 'self-center',
      'flex-start': 'self-start',
      'flex-end': 'self-end',
      stretch: 'self-stretch',
      baseline: 'self-baseline',
    };
    classes.push(alignSelf[style.alignSelf]);
  }

  if (!skip.has('padding')) pushBox(classes, 'p', style.padding);
  if (!skip.has('margin')) pushBox(classes, 'm', style.margin);

  if (style.width !== undefined && !skip.has('width'))
    classes.push(`w-[${formatNumber(style.width)}px]`);
  if (style.height !== undefined && !skip.has('height'))
    classes.push(`h-[${formatNumber(style.height)}px]`);
  if (style.minWidth !== undefined && !skip.has('minWidth'))
    classes.push(`min-w-[${formatNumber(style.minWidth)}px]`);
  if (style.maxWidth !== undefined && !skip.has('maxWidth'))
    classes.push(`max-w-[${formatNumber(style.maxWidth)}px]`);
  if (style.minHeight !== undefined && !skip.has('minHeight'))
    classes.push(`min-h-[${formatNumber(style.minHeight)}px]`);
  if (style.maxHeight !== undefined && !skip.has('maxHeight'))
    classes.push(`max-h-[${formatNumber(style.maxHeight)}px]`);
  if (style.transform) {
    inline.push(['transform', JSON.stringify(style.transform)]);
    inline.push(['transformOrigin', JSON.stringify('0 0')]);
  }
  if (style.overflow) classes.push(`overflow-${style.overflow}`);
  if (style.isolation) classes.push('isolate');
  if (style.objectFit)
    inline.push(['objectFit', JSON.stringify(style.objectFit)]);
  if (style.objectPosition)
    inline.push(['objectPosition', JSON.stringify(style.objectPosition)]);
  if (style.mixBlendMode && !skip.has('mixBlendMode'))
    inline.push(['mixBlendMode', JSON.stringify(style.mixBlendMode)]);
  if (style.visibility && !skip.has('visibility'))
    classes.push(style.visibility === 'hidden' ? 'invisible' : 'visible');

  if (style.backgroundColor && !skip.has('backgroundColor')) {
    if (style.solidFillOpacity)
      inline.push([
        'backgroundColor',
        JSON.stringify(
          solidFillColorToCss(
            style.backgroundColor,
            style.solidFillOpacity,
            mode,
          ),
        ),
      ]);
    else if (needsInline(style.backgroundColor, mode))
      addInline('backgroundColor', style.backgroundColor);
    else
      classes.push(`bg-[${tw(styleValueToCss(style.backgroundColor, mode))}]`);
  }
  const backgroundLayers = paintBackgroundLayersToCss(style, mode);
  if (backgroundLayers && !skip.has('backgroundImage'))
    inline.push(['backgroundImage', JSON.stringify(backgroundLayers)]);
  else if (style.backgroundImage && !skip.has('backgroundImage'))
    inline.push([
      'backgroundImage',
      JSON.stringify(styleValueToCss(style.backgroundImage, mode)),
    ]);
  const backgroundLayout = paintBackgroundLayerLayoutToCss(style);
  if (backgroundLayout) {
    inline.push(['backgroundSize', JSON.stringify(backgroundLayout.size)]);
    inline.push([
      'backgroundPosition',
      JSON.stringify(backgroundLayout.position),
    ]);
    inline.push(['backgroundRepeat', JSON.stringify(backgroundLayout.repeat)]);
  }
  const backgroundBlendModes = paintBackgroundBlendModesToCss(style);
  if (backgroundBlendModes)
    inline.push(['backgroundBlendMode', JSON.stringify(backgroundBlendModes)]);
  if (style.borderRadius && !skip.has('borderRadius')) {
    if (needsInline(style.borderRadius, mode))
      addInline('borderRadius', style.borderRadius);
    else
      classes.push(
        `rounded-[${tw(styleValueToCss(style.borderRadius, mode, true))}]`,
      );
  }
  if (style.borderWidth) {
    if (!skip.has('borderWidth'))
      classes.push(
        `border-[${tw(styleValueToCss(style.borderWidth, mode, true))}]`,
      );
    if (style.borderColor && !skip.has('borderColor')) {
      if (needsInline(style.borderColor, mode))
        addInline('borderColor', style.borderColor);
      else
        classes.push(
          `border-[${tw(styleValueToCss(style.borderColor, mode))}]`,
        );
    }
  }
  if (style.boxShadow && !skip.has('boxShadow')) {
    const s = style.boxShadow;
    if (needsInline(s.color, mode)) {
      inline.push([
        'boxShadow',
        JSON.stringify(
          `${formatNumber(s.offsetX)}px ${formatNumber(
            s.offsetY,
          )}px ${formatNumber(s.blur)}px ${styleValueToCss(s.color, mode)}`,
        ),
      ]);
    } else {
      classes.push(
        `shadow-[${formatNumber(s.offsetX)}px_${formatNumber(
          s.offsetY,
        )}px_${formatNumber(s.blur)}px_${tw(styleValueToCss(s.color, mode))}]`,
      );
    }
  }
  if (!skip.has('opacity')) {
    const opacity = combinedImageOpacityCss(style, mode);
    if (opacity !== undefined) {
      if (Number.isFinite(Number(opacity)))
        classes.push(`opacity-[${opacity}]`);
      else inline.push(['opacity', JSON.stringify(opacity)]);
    }
  }

  if (style.color && !skip.has('color')) {
    if (style.solidFillOpacity)
      inline.push([
        'color',
        JSON.stringify(
          solidFillColorToCss(style.color, style.solidFillOpacity, mode),
        ),
      ]);
    else if (needsInline(style.color, mode)) addInline('color', style.color);
    else classes.push(`text-[${tw(styleValueToCss(style.color, mode))}]`);
  }
  if (style.fontSize && !skip.has('fontSize')) {
    if (needsInline(style.fontSize, mode))
      addInline('fontSize', style.fontSize);
    else
      classes.push(`text-[${tw(styleValueToCss(style.fontSize, mode, true))}]`);
  }
  if (style.fontWeight !== undefined && !skip.has('fontWeight'))
    classes.push(`font-[${style.fontWeight}]`);
  if (style.fontStyle === 'italic' && !skip.has('fontStyle'))
    classes.push('italic');
  if (style.fontVariant && !skip.has('fontVariant'))
    inline.push(['fontVariant', JSON.stringify(style.fontVariant)]);
  if (style.fontKerning && !skip.has('fontKerning'))
    inline.push(['fontKerning', JSON.stringify(style.fontKerning)]);
  if (style.textDecoration && !skip.has('textDecoration'))
    inline.push([
      'textDecoration',
      JSON.stringify(textDecorationToCss(style.textDecoration, mode)),
    ]);
  if (style.fontFamily && !skip.has('fontFamily'))
    classes.push(`font-[${tw(style.fontFamily)}]`);
  if (style.textAlign && !skip.has('textAlign'))
    classes.push(`text-${style.textAlign}`);
  if (style.whiteSpace) {
    classes.push(
      style.whiteSpace === 'pre-wrap'
        ? 'whitespace-pre-wrap'
        : 'whitespace-pre',
    );
  }
  if (style.textWrapWidth !== undefined) {
    if (style.display !== 'inline-block') classes.push('inline-block');
    inline.push(['overflowWrap', JSON.stringify('anywhere')]);
    if (!skip.has('textWrapWidth'))
      classes.push(`max-w-[${formatNumber(style.textWrapWidth)}px]`);
  }
  if (style.maxLines !== undefined && style.textOverflow === 'ellipsis') {
    inline.push(['display', JSON.stringify('-webkit-box')]);
    inline.push(['WebkitBoxOrient', JSON.stringify('vertical')]);
    inline.push(['WebkitLineClamp', String(style.maxLines)]);
    inline.push(['overflow', JSON.stringify('hidden')]);
  } else if (style.maxLines !== undefined && style.textOverflow === 'clip') {
    inline.push(['maxHeight', JSON.stringify(`calc(${style.maxLines} * 1lh)`)]);
    inline.push(['overflow', JSON.stringify('hidden')]);
  }
  if (style.letterSpacing && !skip.has('letterSpacing'))
    classes.push(
      `tracking-[${tw(styleValueToCss(style.letterSpacing, mode, true))}]`,
    );
  if (style.lineHeight && !skip.has('lineHeight'))
    classes.push(
      `leading-[${tw(styleValueToCss(style.lineHeight, mode, true))}]`,
    );
  else if (style.lineHeightRatio !== undefined && !skip.has('lineHeight'))
    inline.push(['lineHeight', formatNumber(style.lineHeightRatio)]);

  return { classes, inline };
}

function pushBox(
  classes: string[],
  prefix: 'p' | 'm',
  v: [number, number, number, number] | undefined,
): void {
  if (!v) return;
  const [t, r, b, l] = v;
  if (t === r && r === b && b === l) {
    classes.push(`${prefix}-[${formatNumber(t)}px]`);
    return;
  }
  if (t === b && r === l) {
    classes.push(`${prefix}y-[${formatNumber(t)}px]`);
    classes.push(`${prefix}x-[${formatNumber(r)}px]`);
    return;
  }
  classes.push(`${prefix}t-[${formatNumber(t)}px]`);
  classes.push(`${prefix}r-[${formatNumber(r)}px]`);
  classes.push(`${prefix}b-[${formatNumber(b)}px]`);
  classes.push(`${prefix}l-[${formatNumber(l)}px]`);
}

interface EmitState {
  mode: CodeVariablesMode;
  indent: string;
  lucideIcons: Set<string>;
  usesIconify: boolean;
  tokenScopeName?: string;
}

function wrapInTokenScope(body: string, state: EmitState): string {
  if (!state.tokenScopeName) return body;
  return `${state.indent.repeat(2)}<${state.tokenScopeName}>\n${body
    .split('\n')
    .map((line) => `${state.indent}${line}`)
    .join('\n')}\n${state.indent.repeat(2)}</${state.tokenScopeName}>`;
}

function renderAttributes(
  node: CodeNode,
  state: EmitState,
): { className: string; styleExpr: string } {
  const skip = new Set<CodeBindingTarget>();
  for (const b of node.bindings ?? []) {
    if (b.target !== 'text') skip.add(b.target);
  }
  const { classes, inline } = genTailwind(node.style, state.mode, skip);
  if (node.element?.tag === 'button') classes.unshift('cursor-pointer');
  if (node.element?.tag === 'a') classes.unshift('no-underline');

  // 样式绑定 → inline style 引用 prop 标识符
  // `gap` must precede its longhands so row/column overrides win.
  const gapBinding = (node.bindings ?? []).find((b) => b.target === 'gap');
  if (gapBinding) inline.push(['gap', gapBinding.prop]);
  for (const b of node.bindings ?? []) {
    if (b.target === 'text' || b.target === 'imageSrc' || b.target === 'gap')
      continue;
    if (b.target === 'lineHeight') {
      inline.push([
        'lineHeight',
        `typeof ${b.prop} === "number" ? (${b.prop} > 0 ? ${b.prop} + "px" : undefined) : ${b.prop}`,
      ]);
    } else if (b.target === 'opacity' && node.style.imageFillOpacity) {
      const fill = node.style.imageFillOpacity;
      const opacity =
        typeof fill.literal === 'number'
          ? `${b.prop} * ${formatNumber(fill.literal)}`
          : `${JSON.stringify('calc(')} + ${b.prop} + ${JSON.stringify(
              ` * ${styleValueToCss(fill, state.mode)})`,
            )}`;
      inline.push(['opacity', opacity]);
    } else {
      inline.push([TARGET_TO_CSS_KEY[b.target], b.prop]);
    }
  }
  if ((node.bindings ?? []).some((b) => b.target === 'borderWidth'))
    inline.push(['borderStyle', JSON.stringify('solid')]);

  const className = classes.length ? ` className="${classes.join(' ')}"` : '';
  let styleExpr = '';
  if (inline.length) {
    const entries = inline.map(([k, v]) => `${k}: ${v}`).join(', ');
    styleExpr = ` style={{ ${entries} }}`;
  }
  return { className, styleExpr };
}

function textExpr(node: CodeNode, state: EmitState): string {
  const textBinding = (node.bindings ?? []).find((b) => b.target === 'text');
  if (textBinding) {
    return `{${textBinding.prop}}`;
  }
  const t = node.text;
  if (!t) return '';
  if (t.token) {
    // resolved 模式不会到这里；preserve/css-var 保留可读字符串
    return escapeJsxText(styleValueToCss(t, state.mode));
  }
  return escapeJsxText(String(t.literal ?? ''));
}

function escapeJsxText(s: string): string {
  // 仅用于 JSX 文本子节点：`<>` 会被当作标签、`{}` 当作表达式、`&` 当作 HTML 实体，
  // 故全部转为字符串字面量表达式。引号在 JSX 文本中是安全的。
  return s.replace(/[{}<>&]/g, (c) => `{'${c}'}`);
}

function renderNode(node: CodeNode, state: EmitState, depth: number): string {
  const pad = state.indent.repeat(depth);

  if (node.instanceOf) {
    const props = Object.entries(node.props ?? {})
      .map(([k, v]) => {
        const val = styleValueToCss(v, state.mode);
        return typeof v.literal === 'number'
          ? `${k}={${val}}`
          : `${k}=${JSON.stringify(val)}`;
      })
      .join(' ');
    const component = `<${node.instanceOf}${props ? ' ' + props : ''} />`;
    if (!node.style.position && node.style.flexShrink === undefined)
      return `${pad}${component}`;
    const { className, styleExpr } = renderAttributes(node, state);
    return `${pad}<div${className}${styleExpr}>${component}</div>`;
  }

  const imageWithChildren = node.role === 'image' && node.children.length > 0;
  const { className, styleExpr } = renderAttributes(
    imageWithChildren
      ? {
          ...node,
          style: {
            ...node.style,
            objectFit: undefined,
            objectPosition: undefined,
            imageFillOpacity: undefined,
          },
        }
      : node,
    state,
  );

  if (node.vectorPath) {
    const path = node.vectorPath;
    const hasChildren = node.children.length > 0;
    const overlay = renderVectorImageStrokeOverlay(path, {
      dialect: 'jsx',
      mode: state.mode,
      indent: state.indent,
      depth: depth + 1,
    });
    const mixed = renderVectorMixedStrokes(path, {
      dialect: 'jsx',
      mode: state.mode,
      indent: state.indent,
      depth: depth + 1,
    });
    const paintLayers = mixed?.strokes ?? overlay;
    const needsWrapper = hasChildren || !!paintLayers;
    const wrapperAttrs =
      paintLayers && !node.style.position
        ? renderAttributes(
            { ...node, style: { ...node.style, position: 'relative' } },
            state,
          )
        : { className, styleExpr };
    const svgStyle = needsWrapper
      ? ' style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}'
      : `${className}${styleExpr}`;
    const svg = renderVectorSvg(mixed?.fill ?? path, {
      dialect: 'jsx',
      mode: state.mode,
      indent: state.indent,
      depth,
      svgStyle,
    });
    if (!needsWrapper) return svg;
    const tag = node.element?.tag ?? 'div';
    const semanticAttr =
      tag === 'button'
        ? ' type="button"'
        : tag === 'a' && node.element?.tag === 'a'
        ? ` href=${JSON.stringify(node.element.href)}`
        : '';
    const children = node.children
      .map((child) => renderNode(child, state, depth + 1))
      .join('\n');
    const nestedSvg = svg
      .split('\n')
      .map((line) => `${state.indent}${line}`)
      .join('\n');
    const artwork = `${nestedSvg}${paintLayers ? `\n${paintLayers}` : ''}`;
    const shadowedArtwork = mixed?.shadow
      ? `${state.indent.repeat(
          depth + 1,
        )}<div style={{ position: "absolute", inset: 0, overflow: "visible", filter: ${JSON.stringify(
          mixed.shadow,
        )} }}>\n${artwork}\n${state.indent.repeat(depth + 1)}</div>`
      : artwork;
    return `${pad}<${tag}${semanticAttr}${wrapperAttrs.className}${
      wrapperAttrs.styleExpr
    }>\n${shadowedArtwork}${children ? `\n${children}` : ''}\n${pad}</${tag}>`;
  }

  if (node.role === 'icon' && node.icon) {
    return renderIcon(node, state, pad, className, styleExpr);
  }

  if (node.role === 'image') {
    const imageBinding = (node.bindings ?? []).find(
      (binding) => binding.target === 'imageSrc',
    );
    const src = imageBinding
      ? `{${imageBinding.prop}}`
      : JSON.stringify(
          node.image ? styleValueToCss(node.image, state.mode) : '',
        );
    if (imageWithChildren) {
      const tag = node.element?.tag ?? 'div';
      const semanticAttr =
        tag === 'button'
          ? ' type="button"'
          : tag === 'a' && node.element?.tag === 'a'
          ? ` href=${JSON.stringify(node.element.href)}`
          : '';
      const imageStyle = [
        'position: "absolute"',
        'inset: 0',
        'width: "100%"',
        'height: "100%"',
        'zIndex: -1',
        'borderRadius: "inherit"',
        'pointerEvents: "none"',
        ...(node.style.objectFit
          ? [`objectFit: ${JSON.stringify(node.style.objectFit)}`]
          : []),
        ...(node.style.objectPosition
          ? [`objectPosition: ${JSON.stringify(node.style.objectPosition)}`]
          : []),
        ...(node.style.imageFillOpacity
          ? [
              `opacity: ${JSON.stringify(
                styleValueToCss(node.style.imageFillOpacity, state.mode),
              )}`,
            ]
          : []),
      ].join(', ');
      const children = node.children
        .map((child) => renderNode(child, state, depth + 1))
        .join('\n');
      return `${pad}<${tag}${semanticAttr}${className}${styleExpr}>\n${state.indent.repeat(
        depth + 1,
      )}<img src=${src} alt="" style={{ ${imageStyle} }} />\n${children}\n${pad}</${tag}>`;
    }
    return `${pad}<img src=${src} alt=${JSON.stringify(
      node.name ?? '',
    )}${className}${styleExpr} />`;
  }

  const tag = node.element?.tag ?? (node.role === 'text' ? 'span' : 'div');
  const semanticAttr =
    tag === 'button'
      ? ' type="button"'
      : tag === 'a' && node.element?.tag === 'a'
      ? ` href=${JSON.stringify(node.element.href)}`
      : '';

  if (node.role === 'text' && node.children.length === 0) {
    return `${pad}<${tag}${semanticAttr}${className}${styleExpr}>${textExpr(
      node,
      state,
    )}</${tag}>`;
  }

  const inner = textExpr(node, state);
  const paints = renderPaintOverlays(
    node.style,
    state.mode,
    'jsx',
    state.indent,
    depth,
  );
  if (node.children.length === 0) {
    if (paints)
      return `${pad}<${tag}${semanticAttr}${className}${styleExpr}>\n${paints}\n${pad}</${tag}>`;
    return `${pad}<${tag}${semanticAttr}${className}${styleExpr}>${inner}</${tag}>`;
  }
  const childrenStr = node.children
    .map((c) => renderNode(c, state, depth + 1))
    .join('\n');
  const leading = inner ? `${state.indent.repeat(depth + 1)}${inner}\n` : '';
  return `${pad}<${tag}${semanticAttr}${className}${styleExpr}>\n${
    paints ? `${paints}\n` : ''
  }${leading}${childrenStr}\n${pad}</${tag}>`;
}

function renderIcon(
  node: CodeNode,
  state: EmitState,
  pad: string,
  className: string,
  styleExpr: string,
): string {
  const icon = node.icon!;
  const name = icon.name.literal ? String(icon.name.literal) : '';
  const size = node.style.width ?? node.style.height;
  const sizeAttr =
    typeof size === 'number' ? ` size={${formatNumber(size)}}` : '';
  if (icon.family === 'lucide') {
    const comp = pascalCase(name) || 'HelpCircle';
    state.lucideIcons.add(comp);
    return `${pad}<${comp}${sizeAttr}${className}${styleExpr} />`;
  }
  state.usesIconify = true;
  return `${pad}<Icon icon=${JSON.stringify(
    `${icon.family}:${name}`,
  )}${className}${styleExpr} />`;
}

function renderComponent(def: CodeComponentDef, state: EmitState): string {
  const propsType = def.props
    .map((p) => {
      const tsType = [
        'fontSize',
        'textWrapWidth',
        'width',
        'height',
        'borderWidth',
        'opacity',
        'gap',
        'rowGap',
        'columnGap',
        'flexGrow',
        'flexShrink',
      ].includes(p.target)
        ? 'number'
        : [
            'fontWeight',
            'fontStyle',
            'fontVariant',
            'fontKerning',
            'textAlign',
            'letterSpacing',
            'lineHeight',
            'textDecoration',
            'flexDirection',
            'alignItems',
            'justifyContent',
            'flexWrap',
            'alignSelf',
            'flexBasis',
            'mixBlendMode',
            'visibility',
            'minWidth',
            'maxWidth',
            'minHeight',
            'maxHeight',
          ].includes(p.target)
        ? `CSSProperties['${p.target}']`
        : 'string';
      return `${state.indent}${p.name}?: ${tsType};`;
    })
    .join('\n');
  const defaults = def.props
    .map((p) => {
      const v = styleValueToCss(p.defaultValue, state.mode);
      return typeof p.defaultValue.literal === 'number'
        ? `${p.name} = ${v}`
        : `${p.name} = ${JSON.stringify(v)}`;
    })
    .join(', ');

  const header = def.props.length
    ? `interface ${def.name}Props {\n${propsType}\n}\n\nexport function ${def.name}({ ${defaults} }: ${def.name}Props) {`
    : `export function ${def.name}() {`;

  const body = wrapInTokenScope(renderNode(def.root, state, 2), state);
  return `${header}\n${state.indent}return (\n${body}\n${state.indent});\n}`;
}

/** 把 Code IR 输出为 React + Tailwind 源码字符串。 */
export function emitReactTailwind(
  ir: CodeIR,
  indent = '  ',
  topName = 'Design',
): string {
  const cssVariables =
    ir.variablesMode === 'css-var' && Object.keys(ir.variables).length > 0
      ? buildDesignVariablesCssRootBlock(ir.variables, ir.themeMode)
      : undefined;
  const scopeClass = cssVariables && variableScopeClass(cssVariables);
  const tokenScopeName = scopeClass
    ? `IcDesignTokens_${scopeClass.slice('ic-codegen-vars-'.length)}`
    : undefined;
  const state: EmitState = {
    mode: ir.variablesMode,
    indent,
    lucideIcons: new Set(),
    usesIconify: false,
    tokenScopeName,
  };

  const componentBlocks = ir.components.map((c) => renderComponent(c, state));

  const rootBody = ir.roots.map((n) => renderNode(n, state, 2)).join('\n');
  const rootWrapped = ir.rootFrame
    ? `${indent.repeat(
        2,
      )}<div className="relative" style={{ width: ${formatNumber(
        ir.rootFrame.width,
      )}, height: ${formatNumber(ir.rootFrame.height)} }}>\n${ir.roots
        .map((n) => renderNode(n, state, 3))
        .join('\n')}\n${indent.repeat(2)}</div>`
    : ir.roots.length === 1
    ? rootBody
    : `${indent.repeat(2)}<>\n${ir.roots
        .map((n) => renderNode(n, state, 3))
        .join('\n')}\n${indent.repeat(2)}</>`;

  const rootWithVariables = wrapInTokenScope(rootWrapped, state);

  // A reusable component also works on its own; nested instances share the
  // parent's scope and avoid emitting duplicate style elements.
  const variableScope =
    cssVariables && scopeClass && tokenScopeName
      ? `const ${tokenScopeName}Context = createContext(false);\n\nfunction ${tokenScopeName}({ children }: { children: ReactNode }) {\n${indent}if (useContext(${tokenScopeName}Context)) return <>{children}</>;\n${indent}return (\n${indent.repeat(
          2,
        )}<>\n${indent.repeat(3)}<style>{${JSON.stringify(
          cssVariables.replace(/^:root\{/, `.${scopeClass}{display:contents;`),
        )}}</style>\n${indent.repeat(
          3,
        )}<div className="${scopeClass}">\n${indent.repeat(
          4,
        )}<${tokenScopeName}Context.Provider value={true}>{children}</${tokenScopeName}Context.Provider>\n${indent.repeat(
          3,
        )}</div>\n${indent.repeat(2)}</>\n${indent});\n}`
      : undefined;

  const topComponent = `export function ${
    pascalCase(topName) || 'Design'
  }() {\n${indent}return (\n${rootWithVariables}\n${indent});\n}`;

  // imports（在确定用到哪些图标后再生成）
  const imports: string[] = [];
  if (variableScope) {
    imports.push(`import { createContext, useContext } from 'react';`);
    imports.push(`import type { ReactNode } from 'react';`);
  }
  if (
    ir.components.some((component) =>
      component.props.some((prop) =>
        [
          'fontWeight',
          'fontStyle',
          'fontVariant',
          'fontKerning',
          'textAlign',
          'letterSpacing',
          'lineHeight',
          'textDecoration',
          'flexDirection',
          'alignItems',
          'justifyContent',
          'flexWrap',
          'alignSelf',
          'flexBasis',
          'mixBlendMode',
          'minWidth',
          'maxWidth',
          'minHeight',
          'maxHeight',
        ].includes(prop.target),
      ),
    )
  ) {
    imports.push(`import type { CSSProperties } from 'react';`);
  }
  if (state.lucideIcons.size) {
    imports.push(
      `import { ${[...state.lucideIcons]
        .sort()
        .join(', ')} } from 'lucide-react';`,
    );
  }
  if (state.usesIconify) {
    imports.push(`import { Icon } from '@iconify/react';`);
  }

  const parts: string[] = [];
  if (imports.length) parts.push(imports.join('\n'));
  if (variableScope) parts.push(variableScope);
  if (componentBlocks.length) parts.push(componentBlocks.join('\n\n'));
  parts.push(topComponent);
  return parts.join('\n\n') + '\n';
}
