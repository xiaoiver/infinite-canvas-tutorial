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
  const style = styleAttr(node, state);
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

  if (node.children.length === 0) {
    return `${pad}<${tag}${semanticAttr}${style}>${text}</${tag}>`;
  }
  const children = node.children
    .map((c) => renderNode(c, state, depth + 1))
    .join('\n');
  const leading = text ? `${state.indent.repeat(depth + 1)}${text}\n` : '';
  return `${pad}<${tag}${semanticAttr}${style}>\n${leading}${children}\n${pad}</${tag}>`;
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
