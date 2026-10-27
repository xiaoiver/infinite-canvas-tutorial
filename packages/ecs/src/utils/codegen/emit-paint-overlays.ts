import { paintBackgroundUrlToCss, styleValueToCss } from './emit-style';
import {
  parsePatternTransform,
  patternOverlayLayout,
} from '../pattern-transform';
import type { CodeVariablesMode, StyleIR } from './types';

type StyleEntry = [css: string, jsx: string, value: string | number];

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function styleAttribute(entries: StyleEntry[], dialect: 'html' | 'jsx') {
  if (dialect === 'html')
    return ` style="${escapeAttr(
      entries.map(([name, , value]) => `${name}: ${value}`).join('; '),
    )}"`;
  return ` style={{ ${entries
    .map(([, name, value]) => `${name}: ${JSON.stringify(value)}`)
    .join(', ')} }}`;
}

/** Decorative paint layers sit behind the node's content in their own clip. */
export function renderPaintOverlays(
  style: StyleIR,
  mode: CodeVariablesMode,
  dialect: 'html' | 'jsx',
  indent: string,
  depth: number,
): string {
  const layers = style.paintOverlays;
  if (!layers?.length) return '';
  const pad = (level: number) => indent.repeat(level);
  const frame = styleAttribute(
    [
      ['position', 'position', 'absolute'],
      ['inset', 'inset', 0],
      ['z-index', 'zIndex', -1],
      ['border-radius', 'borderRadius', 'inherit'],
      ['overflow', 'overflow', 'hidden'],
      ['pointer-events', 'pointerEvents', 'none'],
      ['isolation', 'isolation', 'isolate'],
    ],
    dialect,
  );
  const elements = layers.map((layer) => {
    let entries: StyleEntry[] = [
      ['position', 'position', 'absolute'],
      ['inset', 'inset', 0],
      ['width', 'width', '100%'],
      ['height', 'height', '100%'],
    ];
    if (
      layer.type === 'pattern' &&
      layer.transform &&
      style.width &&
      style.height
    ) {
      const matrix = parsePatternTransform(layer.transform);
      if (matrix) {
        const layout = patternOverlayLayout(matrix, style.width, style.height);
        entries = [
          ['position', 'position', 'absolute'],
          ['left', 'left', `${layout.left}px`],
          ['top', 'top', `${layout.top}px`],
          ['width', 'width', `${layout.width}px`],
          ['height', 'height', `${layout.height}px`],
          ['transform-origin', 'transformOrigin', '0 0'],
          ['transform', 'transform', layout.transform],
        ];
      }
    }
    if (layer.opacity)
      entries.push([
        'opacity',
        'opacity',
        styleValueToCss(layer.opacity, mode),
      ]);
    if (layer.blendMode)
      entries.push(['mix-blend-mode', 'mixBlendMode', layer.blendMode]);
    if (layer.type === 'image') {
      entries.push(['object-fit', 'objectFit', layer.objectFit ?? 'fill']);
      entries.push([
        'object-position',
        'objectPosition',
        layer.objectPosition ?? '50% 50%',
      ]);
      const src =
        dialect === 'html'
          ? `"${escapeAttr(layer.value)}"`
          : JSON.stringify(layer.value);
      return `${pad(depth + 2)}<img src=${src} alt=""${styleAttribute(
        entries,
        dialect,
      )} />`;
    }
    if (layer.type === 'solid')
      entries.push([
        'background-color',
        'backgroundColor',
        styleValueToCss(layer.color, mode),
      ]);
    else if (layer.type === 'gradient')
      entries.push(['background-image', 'backgroundImage', layer.value]);
    else {
      entries.push([
        'background-image',
        'backgroundImage',
        paintBackgroundUrlToCss(layer.value),
      ]);
      entries.push([
        'background-repeat',
        'backgroundRepeat',
        layer.repetition ?? 'repeat',
      ]);
      entries.push(['background-size', 'backgroundSize', 'auto']);
      const matrix = layer.transform
        ? parsePatternTransform(layer.transform)
        : undefined;
      const layout =
        matrix && style.width && style.height
          ? patternOverlayLayout(matrix, style.width, style.height)
          : undefined;
      entries.push([
        'background-position',
        'backgroundPosition',
        layout?.backgroundPosition ?? '0 0',
      ]);
    }
    return `${pad(depth + 2)}<div${styleAttribute(entries, dialect)}></div>`;
  });
  return `${pad(depth + 1)}<div aria-hidden="true"${frame}>\n${elements.join(
    '\n',
  )}\n${pad(depth + 1)}</div>`;
}
