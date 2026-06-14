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
  const decls = styleIRToCssDeclarations(node.style, state.mode);
  if (!decls.length) return '';
  const css = decls.map(([k, v]) => `${k}: ${v}`).join('; ');
  return ` style="${escapeAttr(css)}"`;
}

function renderNode(node: CodeNode, state: HtmlState, depth: number): string {
  const pad = state.indent.repeat(depth);
  const style = styleAttr(node, state);

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
    return `${pad}<span${style}>${text}</span>`;
  }

  if (node.children.length === 0) {
    return `${pad}<div${style}>${text}</div>`;
  }
  const children = node.children
    .map((c) => renderNode(c, state, depth + 1))
    .join('\n');
  const leading = text ? `${state.indent.repeat(depth + 1)}${text}\n` : '';
  return `${pad}<div${style}>\n${leading}${children}\n${pad}</div>`;
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

  for (const n of ir.roots) {
    blocks.push(renderNode(n, state, 0));
  }
  return blocks.join('\n') + '\n';
}
