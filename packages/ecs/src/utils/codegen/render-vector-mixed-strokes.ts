import { renderVectorImageStrokeOverlay } from './render-vector-image-stroke-overlay';
import { renderVectorSvg } from './render-vector-svg';
import { vectorDropShadowToCss } from './emit-style';
import type { CodeNode, CodeVariablesMode } from './types';

type VectorPath = NonNullable<CodeNode['vectorPath']>;

/** Keep SVG and HTML image stroke layers in one isolated, ordered paint stack. */
export function renderVectorMixedStrokes(
  path: VectorPath,
  options: {
    dialect: 'html' | 'jsx';
    mode: CodeVariablesMode;
    indent: string;
    depth: number;
  },
): { fill: VectorPath; strokes: string; shadow?: string } | undefined {
  const layers = path.strokeLayers;
  if (
    !layers?.some((layer) => layer.strokeImage?.rendering === 'foreignObject')
  )
    return undefined;

  const { dialect, mode, indent, depth } = options;
  const pad = (level: number) => indent.repeat(level);
  const fill: VectorPath = {
    ...path,
    stroke: undefined,
    strokeGradient: undefined,
    strokeImage: undefined,
    strokeLayers: undefined,
    strokeWidth: undefined,
    strokeAlignment: undefined,
    dropShadow: undefined,
    markerStart: undefined,
    markerEnd: undefined,
  };
  const strokes = layers
    .map((layer) => {
      if (layer.strokeImage?.rendering === 'foreignObject')
        return renderVectorImageStrokeOverlay(path, { ...options, layer });
      const strokeOnly: VectorPath = {
        ...path,
        fill: undefined,
        fillGradient: undefined,
        fillImage: undefined,
        fillLayers: undefined,
        strokeLayers: [{ ...layer, blendMode: undefined }],
        dropShadow: undefined,
      };
      const blendStyle = layer.blendMode
        ? dialect === 'jsx'
          ? `, mixBlendMode: ${JSON.stringify(layer.blendMode)}`
          : `; mix-blend-mode: ${layer.blendMode}`
        : '';
      const svgStyle =
        dialect === 'jsx'
          ? ` style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none"${blendStyle} }}`
          : ` style="position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none${blendStyle}"`;
      return renderVectorSvg(strokeOnly, {
        dialect,
        mode,
        indent,
        depth: depth + 1,
        svgStyle,
      });
    })
    .filter(Boolean)
    .join('\n');
  const style =
    dialect === 'jsx'
      ? ' style={{ position: "absolute", inset: 0, isolation: "isolate", pointerEvents: "none" }}'
      : ' style="position: absolute; inset: 0; isolation: isolate; pointer-events: none"';
  return {
    fill,
    strokes: `${pad(depth)}<div aria-hidden="true"${style}>\n${strokes}\n${pad(
      depth,
    )}</div>`,
    shadow: path.dropShadow
      ? vectorDropShadowToCss(path.dropShadow, mode)
      : undefined,
  };
}
