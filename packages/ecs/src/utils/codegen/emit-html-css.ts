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
import {
  solidFillColorToCss,
  styleIRToCssDeclarations,
  styleValueToCss,
  vectorDropShadowToCss,
} from './emit-style';
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
  if (node.vectorPath) {
    const path = node.vectorPath;
    const hasChildren = node.children.length > 0;
    const fillServer = path.fillGradient ?? path.fillImage;
    const strokeServer = path.strokeGradient ?? path.strokeImage;
    const fill = fillServer
      ? `url(#${fillServer.id})`
      : path.fill
        ? solidFillColorToCss(path.fill, path.fillOpacity, state.mode)
        : 'none';
    const stroke = strokeServer
      ? `url(#${strokeServer.id})`
      : path.stroke
        ? solidFillColorToCss(path.stroke, path.strokeOpacity, state.mode)
        : 'none';
    const attr = (name: string, value: string | number | undefined) =>
      value === undefined ? '' : ` ${name}="${escapeAttr(String(value))}"`;
    const gradients = [path.fillGradient, path.strokeGradient]
      .filter((gradient) => gradient !== undefined)
      .map((gradient) => {
        const g = gradient.geometry;
        const tag = g.type === 'linear' ? 'linearGradient' : 'radialGradient';
        const geometry =
          g.type === 'linear'
            ? `${attr('x1', formatNumber(g.x1))}${attr('y1', formatNumber(g.y1))}${attr('x2', formatNumber(g.x2))}${attr('y2', formatNumber(g.y2))}`
            : `${attr('cx', formatNumber(g.cx))}${attr('cy', formatNumber(g.cy))}${attr('r', formatNumber(g.r))}`;
        const stops = gradient.stops
          .map(
            (stop) =>
              `${state.indent.repeat(depth + 3)}<stop offset="${formatNumber(stop.offset)}" stop-color="${escapeAttr(stop.color)}" />`,
          )
          .join('\n');
        return `${state.indent.repeat(depth + 2)}<${tag} id="${gradient.id}" gradientUnits="userSpaceOnUse"${geometry}>\n${stops}\n${state.indent.repeat(depth + 2)}</${tag}>`;
      });
    const images = [path.fillImage, path.strokeImage]
      .filter((image) => image !== undefined)
      .map(
        (image) =>
          `${state.indent.repeat(depth + 2)}<pattern id="${image.id}" patternUnits="userSpaceOnUse" x="${formatNumber(path.viewBoxX)}" y="${formatNumber(path.viewBoxY)}" width="${formatNumber(path.width)}" height="${formatNumber(path.height)}">\n${state.indent.repeat(depth + 3)}<image href="${escapeAttr(image.href)}" x="${formatNumber(path.viewBoxX)}" y="${formatNumber(path.viewBoxY)}" width="${formatNumber(path.width)}" height="${formatNumber(path.height)}" preserveAspectRatio="${image.preserveAspectRatio}" />\n${state.indent.repeat(depth + 2)}</pattern>`,
      );
    const markers = [path.markerStart, path.markerEnd]
      .filter((marker) => marker !== undefined)
      .map((marker) => {
        const side = marker === path.markerStart ? 'start' : 'end';
        return `${state.indent.repeat(depth + 2)}<marker id="${marker.id}" markerUnits="userSpaceOnUse" markerWidth="${formatNumber(marker.size)}" markerHeight="${formatNumber(marker.size)}" viewBox="${formatNumber(-marker.offset)} ${formatNumber(-marker.offset)} ${formatNumber(marker.size)} ${formatNumber(marker.size)}" refX="0" refY="0" orient="${side === 'start' ? 'auto-start-reverse' : 'auto'}">\n${state.indent.repeat(depth + 3)}<path d="${escapeAttr(marker.d)}" fill="${marker.fill ? escapeAttr(stroke) : 'none'}"${attr('fill-opacity', marker.fill && strokeServer && path.strokeOpacity ? styleValueToCss(path.strokeOpacity, state.mode) : undefined)} stroke="${escapeAttr(stroke)}"${attr('stroke-opacity', strokeServer && path.strokeOpacity ? styleValueToCss(path.strokeOpacity, state.mode) : undefined)} stroke-width="${formatNumber(marker.strokeWidth)}"${attr('stroke-linecap', marker.strokeLinecap)}${attr('stroke-linejoin', marker.strokeLinejoin)} />\n${state.indent.repeat(depth + 2)}</marker>`;
      });
    const alignment = path.strokeAlignment;
    const alignmentDefinition = alignment
      ? alignment.type === 'inner'
        ? `${state.indent.repeat(depth + 2)}<clipPath id="${alignment.id}" clipPathUnits="userSpaceOnUse">\n${state.indent.repeat(depth + 3)}<path d="${escapeAttr(path.d)}" clip-rule="${path.fillRule}" />\n${state.indent.repeat(depth + 2)}</clipPath>`
        : `${state.indent.repeat(depth + 2)}<mask id="${alignment.id}" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" mask-type="luminance" x="${formatNumber(path.viewBoxX - (path.strokeWidth ?? 0))}" y="${formatNumber(path.viewBoxY - (path.strokeWidth ?? 0))}" width="${formatNumber(path.width + 2 * (path.strokeWidth ?? 0))}" height="${formatNumber(path.height + 2 * (path.strokeWidth ?? 0))}">\n${state.indent.repeat(depth + 3)}<rect x="${formatNumber(path.viewBoxX - (path.strokeWidth ?? 0))}" y="${formatNumber(path.viewBoxY - (path.strokeWidth ?? 0))}" width="${formatNumber(path.width + 2 * (path.strokeWidth ?? 0))}" height="${formatNumber(path.height + 2 * (path.strokeWidth ?? 0))}" fill="white" />\n${state.indent.repeat(depth + 3)}<path d="${escapeAttr(path.d)}" fill="black" fill-rule="${path.fillRule}" />\n${state.indent.repeat(depth + 2)}</mask>`
      : undefined;
    const definitions = [
      ...gradients,
      ...images,
      ...markers,
      ...(alignmentDefinition ? [alignmentDefinition] : []),
    ];
    const defs = definitions.length
      ? `${state.indent.repeat(depth + 1)}<defs>\n${definitions.join('\n')}\n${state.indent.repeat(depth + 1)}</defs>\n`
      : '';
    const shadow = path.dropShadow
      ? vectorDropShadowToCss(path.dropShadow, state.mode)
      : undefined;
    const pathPad = state.indent.repeat(depth + (shadow ? 2 : 1));
    const artworkOpen = shadow
      ? `${state.indent.repeat(depth + 1)}<g style="filter: ${escapeAttr(shadow)}">\n`
      : '';
    const artworkClose = shadow
      ? `${state.indent.repeat(depth + 1)}</g>\n`
      : '';
    const svgStyle = hasChildren
      ? ' style="position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none"'
      : style;
    const alignedStroke = alignment
      ? `${pathPad}<path d="${escapeAttr(path.d)}" fill="none" stroke="${escapeAttr(stroke)}"${attr('stroke-opacity', strokeServer && path.strokeOpacity ? styleValueToCss(path.strokeOpacity, state.mode) : undefined)}${attr('stroke-width', 2 * (path.strokeWidth ?? 0))}${attr('stroke-linecap', path.strokeLinecap)}${attr('stroke-linejoin', path.strokeLinejoin)}${attr('stroke-miterlimit', path.strokeMiterlimit)}${attr('stroke-dasharray', path.strokeDasharray)}${attr('stroke-dashoffset', path.strokeDashoffset)}${attr('marker-start', path.markerStart && `url(#${path.markerStart.id})`)}${attr('marker-end', path.markerEnd && `url(#${path.markerEnd.id})`)}${attr(alignment.type === 'inner' ? 'clip-path' : 'mask', `url(#${alignment.id})`)} />\n`
      : '';
    const svg = `${pad}<svg viewBox="${formatNumber(path.viewBoxX)} ${formatNumber(path.viewBoxY)} ${formatNumber(path.width)} ${formatNumber(
      path.height,
    )}" aria-hidden="true"${svgStyle}>\n${defs}${artworkOpen}${pathPad}<path d="${escapeAttr(path.d)}" fill="${escapeAttr(fill)}"${attr('fill-opacity', fillServer && path.fillOpacity ? styleValueToCss(path.fillOpacity, state.mode) : undefined)} fill-rule="${
      path.fillRule
    }" stroke="${alignment ? 'none' : escapeAttr(stroke)}"${attr('stroke-opacity', strokeServer && path.strokeOpacity ? styleValueToCss(path.strokeOpacity, state.mode) : undefined)}${attr(
      'stroke-width',
      path.strokeWidth,
    )}${attr('stroke-linecap', path.strokeLinecap)}${attr(
      'stroke-linejoin',
      path.strokeLinejoin,
    )}${attr('stroke-miterlimit', path.strokeMiterlimit)}${attr(
      'stroke-dasharray',
      path.strokeDasharray,
    )}${attr('stroke-dashoffset', path.strokeDashoffset)}${attr('marker-start', !alignment && path.markerStart ? `url(#${path.markerStart.id})` : undefined)}${attr('marker-end', !alignment && path.markerEnd ? `url(#${path.markerEnd.id})` : undefined)} />\n${alignedStroke}${artworkClose}${pad}</svg>`;
    if (!hasChildren) return svg;
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
    return `${pad}<${tag}${semanticAttr}${style}>\n${nestedSvg}\n${children}\n${pad}</${tag}>`;
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
