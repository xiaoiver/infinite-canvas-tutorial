/**
 * Code IR → HTML + CSS（inline style）字符串。
 *
 * HTML 没有组件概念，故本 emitter 期望传入 **已扁平化**（`componentStructure: 'flatten'`）的
 * IR；编排层会在选择本框架时自动采用 flatten。变量模式：`resolved` 输出字面量，`css-var`
 * 额外注入 `:root{...}` 并用 `var(--token)`，`preserve-token` 保留 `$token`。
 */
import {
  buildDesignVariablesCssRootBlock,
  type DesignVariablesMap,
} from '../design-variables';
import type { ThemeMode } from '../../components/Theme';
import { formatNumber } from '../serialize/points';
import { renderVectorSvg } from './render-vector-svg';
import { renderVectorImageStrokeOverlay } from './render-vector-image-stroke-overlay';
import { renderVectorMixedStrokes } from './render-vector-mixed-strokes';
import { renderPaintOverlays } from './emit-paint-overlays';
import { styleIRToCssDeclarations, styleValueToCss } from './emit-style';
import type { CodeIR, CodeNode, CodeVariablesMode } from './types';

interface HtmlState {
  mode: CodeVariablesMode;
  indent: string;
}

function escapeHtml(s: string): string {
  // 仅用于元素文本内容；属性值请用 escapeAttr（其额外转义引号）。
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function styleAttr(node: CodeNode, state: HtmlState): string {
  const tag = node.element?.tag;
  const reset: Array<[string, string]> =
    tag === 'button'
      ? [
          ['appearance', 'none'],
          ['border', '0'],
          ['padding', '0'],
          ['font', 'inherit'],
          ['cursor', 'pointer'],
        ]
      : tag === 'a'
      ? [
          ['color', 'inherit'],
          ['text-decoration', 'none'],
        ]
      : tag === 'h1' || tag === 'h2' || tag === 'p'
      ? [['margin', '0']]
      : [];
  const decls = [...reset, ...styleIRToCssDeclarations(node.style, state.mode)];
  if (!decls.length) return '';
  const css = decls.map(([k, v]) => `${k}: ${v}`).join('; ');
  return ` style="${escapeAttr(css)}"`;
}

function renderNode(node: CodeNode, state: HtmlState, depth: number): string {
  const pad = state.indent.repeat(depth);
  const imageWithChildren = node.role === 'image' && node.children.length > 0;
  const style = styleAttr(
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
      dialect: 'html',
      mode: state.mode,
      indent: state.indent,
      depth: depth + 1,
    });
    const mixed = renderVectorMixedStrokes(path, {
      dialect: 'html',
      mode: state.mode,
      indent: state.indent,
      depth: depth + 1,
    });
    const paintLayers = mixed?.strokes ?? overlay;
    const needsWrapper = hasChildren || !!paintLayers;
    const wrapperStyle =
      paintLayers && !node.style.position
        ? styleAttr(
            { ...node, style: { ...node.style, position: 'relative' } },
            state,
          )
        : style;
    const svgStyle = needsWrapper
      ? ' style="position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none"'
      : style;
    const svg = renderVectorSvg(mixed?.fill ?? path, {
      dialect: 'html',
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
        ? ` href="${escapeAttr(node.element.href)}"`
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
        )}<div style="position: absolute; inset: 0; overflow: visible; filter: ${escapeAttr(
          mixed.shadow,
        )}">\n${artwork}\n${state.indent.repeat(depth + 1)}</div>`
      : artwork;
    return `${pad}<${tag}${semanticAttr}${wrapperStyle}>\n${shadowedArtwork}${
      children ? `\n${children}` : ''
    }\n${pad}</${tag}>`;
  }
  const tag = node.element?.tag ?? (node.role === 'text' ? 'span' : 'div');
  const semanticAttr =
    tag === 'button'
      ? ' type="button"'
      : tag === 'a' && node.element?.tag === 'a'
      ? ` href="${escapeAttr(node.element.href)}"`
      : '';

  if (node.role === 'icon' && node.icon) {
    const name = node.icon.name.literal ? String(node.icon.name.literal) : '';
    return `${pad}<iconify-icon icon="${escapeAttr(
      `${node.icon.family}:${name}`,
    )}"${style}></iconify-icon>`;
  }

  if (node.role === 'image') {
    const src = node.image ? styleValueToCss(node.image, state.mode) : '';
    if (imageWithChildren) {
      const imageCss = [
        'position: absolute',
        'inset: 0',
        'width: 100%',
        'height: 100%',
        'z-index: -1',
        'border-radius: inherit',
        'pointer-events: none',
        ...(node.style.objectFit
          ? [`object-fit: ${node.style.objectFit}`]
          : []),
        ...(node.style.objectPosition
          ? [`object-position: ${node.style.objectPosition}`]
          : []),
        ...(node.style.imageFillOpacity
          ? [
              `opacity: ${styleValueToCss(
                node.style.imageFillOpacity,
                state.mode,
              )}`,
            ]
          : []),
      ].join('; ');
      const children = node.children
        .map((child) => renderNode(child, state, depth + 1))
        .join('\n');
      return `${pad}<${tag}${semanticAttr}${style}>\n${state.indent.repeat(
        depth + 1,
      )}<img src="${escapeAttr(src)}" alt="" style="${escapeAttr(
        imageCss,
      )}" />\n${children}\n${pad}</${tag}>`;
    }
    return `${pad}<img src="${escapeAttr(src)}" alt="${escapeAttr(
      node.name ?? '',
    )}"${style} />`;
  }

  const text = node.text
    ? escapeHtml(
        node.text.literal !== undefined
          ? String(node.text.literal)
          : styleValueToCss(node.text, state.mode),
      )
    : '';

  if (node.role === 'text' && node.children.length === 0) {
    return `${pad}<${tag}${semanticAttr}${style}>${text}</${tag}>`;
  }

  const paints = renderPaintOverlays(
    node.style,
    state.mode,
    'html',
    state.indent,
    depth,
  );
  if (node.children.length === 0) {
    if (paints)
      return `${pad}<${tag}${semanticAttr}${style}>\n${paints}\n${pad}</${tag}>`;
    return `${pad}<${tag}${semanticAttr}${style}>${text}</${tag}>`;
  }
  const children = node.children
    .map((c) => renderNode(c, state, depth + 1))
    .join('\n');
  const leading = text ? `${state.indent.repeat(depth + 1)}${text}\n` : '';
  return `${pad}<${tag}${semanticAttr}${style}>\n${
    paints ? `${paints}\n` : ''
  }${leading}${children}\n${pad}</${tag}>`;
}

/** 把 Code IR 输出为 HTML + CSS 源码字符串。 */
export function emitHtmlCss(ir: CodeIR, indent = '  '): string {
  const state: HtmlState = { mode: ir.variablesMode, indent };
  const blocks: string[] = [];

  if (ir.variablesMode === 'css-var' && Object.keys(ir.variables).length) {
    const root = buildDesignVariablesCssRootBlock(
      ir.variables as DesignVariablesMap,
      ir.themeMode as ThemeMode | undefined,
    );
    blocks.push(`<style>\n${indent}${root}\n</style>`);
  }

  if (ir.rootFrame) {
    const { width, height } = ir.rootFrame;
    blocks.push(
      `<div style="position: relative; width: ${formatNumber(
        width,
      )}px; height: ${formatNumber(height)}px">\n${ir.roots
        .map((node) => renderNode(node, state, 1))
        .join('\n')}\n</div>`,
    );
  } else {
    for (const n of ir.roots) blocks.push(renderNode(n, state, 0));
  }
  return blocks.join('\n') + '\n';
}
