import { mat3 } from 'gl-matrix';
import { parseObjectPosition } from '../fill-layer-image-object-fit';
import { formatNumber } from '../serialize/points';
import { transformPath } from '../serialize/path-transform';
import { styleValueToCss } from './emit-style';
import type {
  CodeNode,
  CodeVariablesMode,
  CodeVectorMarker,
  CodeVectorStrokeLayer,
} from './types';

type VectorPath = NonNullable<CodeNode['vectorPath']>;
type ForeignImage = Extract<
  NonNullable<VectorPath['strokeImage']>,
  { rendering: 'foreignObject' }
>;

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** HTML paint layer for image strokes that cannot be expressed by SVG image alignment. */
export function renderVectorImageStrokeOverlay(
  path: VectorPath,
  options: {
    dialect: 'html' | 'jsx';
    mode: CodeVariablesMode;
    indent: string;
    depth: number;
    layer?: CodeVectorStrokeLayer;
  },
): string | undefined {
  const image = options.layer?.strokeImage ?? path.strokeImage;
  if (image?.rendering !== 'foreignObject') return undefined;
  const paint: ForeignImage = image;
  const { dialect, mode, indent, depth } = options;
  const markerStart = options.layer?.markerStart ?? path.markerStart;
  const markerEnd = options.layer?.markerEnd ?? path.markerEnd;
  const pad = (level: number) => indent.repeat(level);
  const margin = Math.max(
    path.strokeWidth ?? 0,
    markerStart?.size ?? 0,
    markerEnd?.size ?? 0,
  );
  const width = path.width + 2 * margin;
  const height = path.height + 2 * margin;
  const localD = transformPath(
    path.d,
    mat3.fromTranslation(mat3.create(), [
      margin - path.viewBoxX,
      margin - path.viewBoxY,
    ]),
  );
  const svgAttr = (name: string, value: string | number | undefined) =>
    value === undefined ? '' : ` ${name}="${escapeAttribute(String(value))}"`;
  const marker = (value: CodeVectorMarker | undefined, side: 'start' | 'end') =>
    value
      ? `<marker id="${side}" markerUnits="userSpaceOnUse"${svgAttr(
          'markerWidth',
          value.size,
        )}${svgAttr('markerHeight', value.size)}${svgAttr(
          'viewBox',
          `${-value.offset} ${-value.offset} ${value.size} ${value.size}`,
        )} refX="0" refY="0" orient="${
          side === 'start' ? 'auto-start-reverse' : 'auto'
        }"><path${svgAttr('d', value.d)} fill="${
          value.fill ? 'white' : 'none'
        }" stroke="white"${svgAttr('stroke-width', value.strokeWidth)}${svgAttr(
          'stroke-linecap',
          value.strokeLinecap,
        )}${svgAttr('stroke-linejoin', value.strokeLinejoin)}/></marker>`
      : '';
  const alignment = path.strokeAlignment;
  const alignmentDef =
    alignment?.type === 'inner'
      ? `<clipPath id="align"><path${svgAttr('d', localD)}${svgAttr(
          'clip-rule',
          path.fillRule,
        )}/></clipPath>`
      : alignment?.type === 'outer'
      ? `<mask id="align" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0"${svgAttr(
          'width',
          width,
        )}${svgAttr('height', height)}><rect x="0" y="0"${svgAttr(
          'width',
          width,
        )}${svgAttr('height', height)} fill="white"/><path${svgAttr(
          'd',
          localD,
        )} fill="black"${svgAttr('fill-rule', path.fillRule)}/></mask>`
      : '';
  const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg"${svgAttr(
    'width',
    width,
  )}${svgAttr('height', height)}${svgAttr(
    'viewBox',
    `0 0 ${formatNumber(width)} ${formatNumber(height)}`,
  )}><defs>${marker(markerStart, 'start')}${marker(
    markerEnd,
    'end',
  )}${alignmentDef}</defs><path${svgAttr(
    'd',
    localD,
  )} fill="none" stroke="white"${svgAttr(
    'stroke-width',
    alignment ? 2 * (path.strokeWidth ?? 0) : path.strokeWidth,
  )}${svgAttr('stroke-linecap', path.strokeLinecap)}${svgAttr(
    'stroke-linejoin',
    path.strokeLinejoin,
  )}${svgAttr('stroke-miterlimit', path.strokeMiterlimit)}${svgAttr(
    'stroke-dasharray',
    path.strokeDasharray,
  )}${svgAttr('stroke-dashoffset', path.strokeDashoffset)}${svgAttr(
    'marker-start',
    markerStart ? 'url(#start)' : undefined,
  )}${svgAttr('marker-end', markerEnd ? 'url(#end)' : undefined)}${svgAttr(
    alignment?.type === 'inner' ? 'clip-path' : 'mask',
    alignment ? 'url(#align)' : undefined,
  )}/></svg>`;
  const maskUrl = `data:image/svg+xml,${encodeURIComponent(maskSvg)}`;
  const strokeOpacity = options.layer?.strokeOpacity ?? path.strokeOpacity;
  const opacity = strokeOpacity
    ? styleValueToCss(strokeOpacity, mode)
    : undefined;
  const objectPosition = parseObjectPosition(paint.objectPosition);
  const x = `${formatNumber(objectPosition.x * 100)}%`;
  const y = `${formatNumber(objectPosition.y * 100)}%`;
  const naturalSize =
    paint.objectFit === 'none' || paint.objectFit === 'scale-down';
  if (dialect === 'jsx') {
    const outerStyle = [
      'position: "absolute"',
      `left: ${formatNumber(-margin)}`,
      `top: ${formatNumber(-margin)}`,
      `width: ${formatNumber(width)}`,
      `height: ${formatNumber(height)}`,
      'pointerEvents: "none"',
      `maskImage: ${JSON.stringify(`url("${maskUrl}")`)}`,
      `WebkitMaskImage: ${JSON.stringify(`url("${maskUrl}")`)}`,
      'maskSize: "100% 100%"',
      'WebkitMaskSize: "100% 100%"',
      'maskRepeat: "no-repeat"',
      'WebkitMaskRepeat: "no-repeat"',
      ...(options.layer?.blendMode
        ? [`mixBlendMode: ${JSON.stringify(options.layer.blendMode)}`]
        : []),
      ...(opacity ? [`opacity: ${JSON.stringify(opacity)}`] : []),
    ];
    const imageStyle = naturalSize
      ? [
          'position: "absolute"',
          `left: "${x}"`,
          `top: "${y}"`,
          `transform: "translate(-${x}, -${y})"`,
          'width: "auto"',
          'height: "auto"',
          ...(paint.objectFit === 'scale-down'
            ? ['maxWidth: "100%"', 'maxHeight: "100%"']
            : []),
        ]
      : ['width: "100%"', 'height: "100%"'];
    imageStyle.push(
      `objectFit: ${JSON.stringify(paint.objectFit)}`,
      `objectPosition: ${JSON.stringify(paint.objectPosition)}`,
      'display: "block"',
    );
    return `${pad(depth)}<div aria-hidden="true" style={{ ${outerStyle.join(
      ', ',
    )} }}>\n${pad(
      depth + 1,
    )}<div style={{ position: "absolute", left: ${formatNumber(
      margin,
    )}, top: ${formatNumber(margin)}, width: ${formatNumber(
      path.width,
    )}, height: ${formatNumber(path.height)}, overflow: "visible" }}>\n${pad(
      depth + 2,
    )}<img src={${JSON.stringify(
      paint.href,
    )}} alt="" style={{ ${imageStyle.join(', ')} }} />\n${pad(
      depth + 1,
    )}</div>\n${pad(depth)}</div>`;
  }
  const outerStyle = [
    'position: absolute',
    `left: ${formatNumber(-margin)}px`,
    `top: ${formatNumber(-margin)}px`,
    `width: ${formatNumber(width)}px`,
    `height: ${formatNumber(height)}px`,
    'pointer-events: none',
    `mask-image: url('${maskUrl}')`,
    `-webkit-mask-image: url('${maskUrl}')`,
    'mask-size: 100% 100%',
    '-webkit-mask-size: 100% 100%',
    'mask-repeat: no-repeat',
    '-webkit-mask-repeat: no-repeat',
    ...(options.layer?.blendMode
      ? [`mix-blend-mode: ${options.layer.blendMode}`]
      : []),
    ...(opacity ? [`opacity: ${opacity}`] : []),
  ];
  const imageStyle = naturalSize
    ? [
        'position: absolute',
        `left: ${x}`,
        `top: ${y}`,
        `transform: translate(-${x}, -${y})`,
        'width: auto',
        'height: auto',
        ...(paint.objectFit === 'scale-down'
          ? ['max-width: 100%', 'max-height: 100%']
          : []),
      ]
    : ['width: 100%', 'height: 100%'];
  imageStyle.push(
    `object-fit: ${paint.objectFit}`,
    `object-position: ${paint.objectPosition}`,
    'display: block',
  );
  return `${pad(depth)}<div aria-hidden="true" style="${escapeAttribute(
    outerStyle.join('; '),
  )}">\n${pad(depth + 1)}<div style="position: absolute; left: ${formatNumber(
    margin,
  )}px; top: ${formatNumber(margin)}px; width: ${formatNumber(
    path.width,
  )}px; height: ${formatNumber(path.height)}px; overflow: visible">\n${pad(
    depth + 2,
  )}<img src="${escapeAttribute(paint.href)}" alt="" style="${escapeAttribute(
    imageStyle.join('; '),
  )}" />\n${pad(depth + 1)}</div>\n${pad(depth)}</div>`;
}
