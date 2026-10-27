import { formatNumber } from '../serialize/points';
import {
  solidFillColorToCss,
  styleValueToCss,
  vectorDropShadowToCss,
} from './emit-style';
import type {
  CodeNode,
  CodeVariablesMode,
  CodeVectorFillLayer,
  CodeVectorImage,
  CodeVectorMarker,
  CodeVectorStrokeLayer,
} from './types';

type VectorPath = NonNullable<CodeNode['vectorPath']>;
type Attribute = [string, string | number | undefined];

interface RenderOptions {
  dialect: 'html' | 'jsx';
  mode: CodeVariablesMode;
  indent: string;
  depth: number;
  svgStyle: string;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** Shared SVG artwork for the HTML and React code emitters. */
export function renderVectorSvg(
  path: VectorPath,
  options: RenderOptions,
): string {
  const { dialect, mode, indent, depth, svgStyle } = options;
  const pad = (level: number) => indent.repeat(level);
  const attr = ([name, value]: Attribute): string => {
    if (value === undefined) return '';
    if (dialect === 'html')
      return ` ${name}="${escapeAttribute(
        typeof value === 'number' ? formatNumber(value) : value,
      )}"`;
    const jsxName = name.replace(/-([a-z])/g, (_, letter: string) =>
      letter.toUpperCase(),
    );
    if (
      [
        'gradientUnits',
        'patternUnits',
        'markerUnits',
        'clipPathUnits',
        'maskUnits',
        'maskContentUnits',
        'mask-type',
        'orient',
      ].includes(name) ||
      (name === 'fill' && (value === 'white' || value === 'black'))
    )
      return ` ${jsxName}="${escapeAttribute(String(value))}"`;
    return ` ${jsxName}={${
      typeof value === 'number' ? formatNumber(value) : JSON.stringify(value)
    }}`;
  };
  const attrs = (values: Attribute[]) => values.map(attr).join('');
  const leaf = (
    tag: string,
    values: Attribute[],
    level: number,
    extraAttrs = '',
  ) => `${pad(level)}<${tag}${attrs(values)}${extraAttrs} />`;
  const wrap = (
    tag: string,
    values: Attribute[],
    body: string,
    level: number,
    extraAttrs = '',
  ) =>
    `${pad(level)}<${tag}${attrs(values)}${extraAttrs}>\n${body}\n${pad(
      level,
    )}</${tag}>`;

  const imageBox: Attribute[] = [
    ['x', path.viewBoxX],
    ['y', path.viewBoxY],
    ['width', path.width],
    ['height', path.height],
  ];
  const renderForeignImage = (
    image: Extract<CodeVectorImage, { rendering: 'foreignObject' }>,
    opacity: string | undefined,
    level: number,
    extraAttrs = '',
  ) => {
    const containerStyle =
      dialect === 'jsx'
        ? ' style={{ width: "100%", height: "100%" }}'
        : ' style="width: 100%; height: 100%"';
    const imageStyle =
      dialect === 'jsx'
        ? ` style={{ display: "block", width: "100%", height: "100%", objectFit: ${JSON.stringify(
            image.objectFit,
          )}, objectPosition: ${JSON.stringify(image.objectPosition)} }}`
        : ` style="display: block; width: 100%; height: 100%; object-fit: ${escapeAttribute(
            image.objectFit,
          )}; object-position: ${escapeAttribute(image.objectPosition)}"`;
    return wrap(
      'foreignObject',
      [
        ...imageBox,
        ['clip-path', `url(#${image.id}-clip)`],
        ['opacity', opacity],
      ],
      wrap(
        'div',
        [['xmlns', 'http://www.w3.org/1999/xhtml']],
        leaf(
          'img',
          [
            ['src', image.href],
            ['alt', ''],
          ],
          level + 2,
          imageStyle,
        ),
        level + 1,
        containerStyle,
      ),
      level,
      extraAttrs,
    );
  };

  const fillPaint = (layer: CodeVectorFillLayer) => {
    const server = layer.fillGradient ?? layer.fillImage;
    return layer.fillImage?.rendering === 'foreignObject'
      ? 'none'
      : server
      ? `url(#${server.id})`
      : layer.fill
      ? solidFillColorToCss(layer.fill, layer.fillOpacity, mode)
      : 'none';
  };
  const paintOpacity = (layer: CodeVectorFillLayer) =>
    (layer.fillGradient || layer.fillImage?.rendering === 'pattern') &&
    layer.fillOpacity
      ? styleValueToCss(layer.fillOpacity, mode)
      : undefined;
  const strokePaint = (layer: CodeVectorStrokeLayer) => {
    const server = layer.strokeGradient ?? layer.strokeImage;
    return server
      ? `url(#${server.id})`
      : layer.stroke
      ? solidFillColorToCss(layer.stroke, layer.strokeOpacity, mode)
      : 'none';
  };
  const strokePaintOpacity = (layer: CodeVectorStrokeLayer) =>
    (layer.strokeGradient || layer.strokeImage) && layer.strokeOpacity
      ? styleValueToCss(layer.strokeOpacity, mode)
      : undefined;
  const strokeServer = path.strokeGradient ?? path.strokeImage;
  const fill = fillPaint(path);
  const stroke =
    path.strokeImage?.rendering === 'foreignObject'
      ? 'none'
      : strokeServer
      ? `url(#${strokeServer.id})`
      : path.stroke
      ? solidFillColorToCss(path.stroke, path.strokeOpacity, mode)
      : 'none';
  const fillOpacity = paintOpacity(path);
  const strokeOpacity =
    strokeServer &&
    path.strokeImage?.rendering !== 'foreignObject' &&
    path.strokeOpacity
      ? styleValueToCss(path.strokeOpacity, mode)
      : undefined;

  const gradients = [
    path.fillGradient,
    path.strokeGradient,
    ...(path.fillLayers?.map((layer) => layer.fillGradient) ?? []),
    ...(path.strokeLayers?.map((layer) => layer.strokeGradient) ?? []),
  ]
    .filter((gradient) => gradient !== undefined)
    .map((gradient) => {
      const geometry = gradient.geometry;
      const tag =
        geometry.type === 'linear' ? 'linearGradient' : 'radialGradient';
      const coordinates: Attribute[] =
        geometry.type === 'linear'
          ? [
              ['x1', geometry.x1],
              ['y1', geometry.y1],
              ['x2', geometry.x2],
              ['y2', geometry.y2],
            ]
          : [
              ['cx', geometry.cx],
              ['cy', geometry.cy],
              ['r', geometry.r],
            ];
      const stops = gradient.stops
        .map((stop) =>
          leaf(
            'stop',
            [
              ['offset', stop.offset],
              ['stop-color', stop.color],
            ],
            depth + 3,
          ),
        )
        .join('\n');
      return wrap(
        tag,
        [
          ['id', gradient.id],
          ['gradientUnits', 'userSpaceOnUse'],
          ...coordinates,
        ],
        stops,
        depth + 2,
      );
    });
  const images = [
    path.fillImage,
    path.strokeImage,
    ...(path.fillLayers?.map((layer) => layer.fillImage) ?? []),
    ...(path.strokeLayers?.map((layer) => layer.strokeImage) ?? []),
  ]
    .filter((image) => image?.rendering === 'pattern')
    .map((image) => {
      return wrap(
        'pattern',
        [['id', image.id], ['patternUnits', 'userSpaceOnUse'], ...imageBox],
        leaf(
          'image',
          [
            ['href', image.href],
            ...imageBox,
            ['preserveAspectRatio', image.preserveAspectRatio],
          ],
          depth + 3,
        ),
        depth + 2,
      );
    });
  const imageClips = [
    path.fillImage,
    ...(path.fillLayers?.map((layer) => layer.fillImage) ?? []),
  ]
    .filter((image) => image?.rendering === 'foreignObject')
    .map((image) =>
      wrap(
        'clipPath',
        [
          ['id', `${image.id}-clip`],
          ['clipPathUnits', 'userSpaceOnUse'],
        ],
        leaf(
          'path',
          [
            ['d', path.d],
            ['clip-rule', path.fillRule],
          ],
          depth + 3,
        ),
        depth + 2,
      ),
    );
  const markerEntries: Array<{
    marker: CodeVectorMarker;
    side: 'start' | 'end';
    paint: string;
    opacity?: string;
  }> = [];
  if (path.markerStart && path.strokeImage?.rendering !== 'foreignObject')
    markerEntries.push({
      marker: path.markerStart,
      side: 'start',
      paint: stroke,
      opacity: strokeOpacity,
    });
  if (path.markerEnd && path.strokeImage?.rendering !== 'foreignObject')
    markerEntries.push({
      marker: path.markerEnd,
      side: 'end',
      paint: stroke,
      opacity: strokeOpacity,
    });
  for (const layer of path.strokeLayers ?? []) {
    const paint = strokePaint(layer);
    const opacity = strokePaintOpacity(layer);
    if (layer.markerStart)
      markerEntries.push({
        marker: layer.markerStart,
        side: 'start',
        paint,
        opacity,
      });
    if (layer.markerEnd)
      markerEntries.push({
        marker: layer.markerEnd,
        side: 'end',
        paint,
        opacity,
      });
  }
  const markers = markerEntries.map(({ marker, side, paint, opacity }) => {
    return wrap(
      'marker',
      [
        ['id', marker.id],
        ['markerUnits', 'userSpaceOnUse'],
        ['markerWidth', marker.size],
        ['markerHeight', marker.size],
        [
          'viewBox',
          `${formatNumber(-marker.offset)} ${formatNumber(
            -marker.offset,
          )} ${formatNumber(marker.size)} ${formatNumber(marker.size)}`,
        ],
        ['refX', 0],
        ['refY', 0],
        ['orient', side === 'start' ? 'auto-start-reverse' : 'auto'],
      ],
      leaf(
        'path',
        [
          ['d', marker.d],
          ['fill', marker.fill ? paint : 'none'],
          ['fill-opacity', marker.fill ? opacity : undefined],
          ['stroke', paint],
          ['stroke-opacity', opacity],
          ['stroke-width', marker.strokeWidth],
          ['stroke-linecap', marker.strokeLinecap],
          ['stroke-linejoin', marker.strokeLinejoin],
        ],
        depth + 3,
      ),
      depth + 2,
    );
  });
  const alignment = path.strokeAlignment;
  const margin = path.strokeWidth ?? 0;
  const maskBox: Attribute[] = [
    ['x', path.viewBoxX - margin],
    ['y', path.viewBoxY - margin],
    ['width', path.width + 2 * margin],
    ['height', path.height + 2 * margin],
  ];
  const alignmentDefinition = alignment
    ? alignment.type === 'inner'
      ? wrap(
          'clipPath',
          [
            ['id', alignment.id],
            ['clipPathUnits', 'userSpaceOnUse'],
          ],
          leaf(
            'path',
            [
              ['d', path.d],
              ['clip-rule', path.fillRule],
            ],
            depth + 3,
          ),
          depth + 2,
        )
      : wrap(
          'mask',
          [
            ['id', alignment.id],
            ['maskUnits', 'userSpaceOnUse'],
            ['maskContentUnits', 'userSpaceOnUse'],
            ['mask-type', 'luminance'],
            ...maskBox,
          ],
          [
            leaf('rect', [...maskBox, ['fill', 'white']], depth + 3),
            leaf(
              'path',
              [
                ['d', path.d],
                ['fill', 'black'],
                ['fill-rule', path.fillRule],
              ],
              depth + 3,
            ),
          ].join('\n'),
          depth + 2,
        )
    : undefined;
  const definitions = [
    ...gradients,
    ...images,
    ...imageClips,
    ...markers,
    ...(alignmentDefinition ? [alignmentDefinition] : []),
  ];
  const defs = definitions.length
    ? `${wrap('defs', [], definitions.join('\n'), depth + 1)}\n`
    : '';

  const pathAttrs: Attribute[] = [
    ['d', path.d],
    ['fill', fill],
    ['fill-opacity', fillOpacity],
    ['fill-rule', path.fillRule],
    ['stroke', alignment || path.strokeLayers ? 'none' : stroke],
    ['stroke-opacity', strokeOpacity],
    ['stroke-width', path.strokeLayers ? undefined : path.strokeWidth],
    ['stroke-linecap', path.strokeLinecap],
    ['stroke-linejoin', path.strokeLinejoin],
    ['stroke-miterlimit', path.strokeMiterlimit],
    ['stroke-dasharray', path.strokeDasharray],
    ['stroke-dashoffset', path.strokeDashoffset],
    [
      'marker-start',
      !alignment &&
      path.strokeImage?.rendering !== 'foreignObject' &&
      path.markerStart
        ? `url(#${path.markerStart.id})`
        : undefined,
    ],
    [
      'marker-end',
      !alignment &&
      path.strokeImage?.rendering !== 'foreignObject' &&
      path.markerEnd
        ? `url(#${path.markerEnd.id})`
        : undefined,
    ],
  ];
  const strokeAttrs: Attribute[] = [
    ['d', path.d],
    ['fill', 'none'],
    ['stroke', stroke],
    ['stroke-opacity', strokeOpacity],
    ['stroke-width', 2 * (path.strokeWidth ?? 0)],
    ['stroke-linecap', path.strokeLinecap],
    ['stroke-linejoin', path.strokeLinejoin],
    ['stroke-miterlimit', path.strokeMiterlimit],
    ['stroke-dasharray', path.strokeDasharray],
    ['stroke-dashoffset', path.strokeDashoffset],
    [
      'marker-start',
      path.strokeImage?.rendering !== 'foreignObject' && path.markerStart
        ? `url(#${path.markerStart.id})`
        : undefined,
    ],
    [
      'marker-end',
      path.strokeImage?.rendering !== 'foreignObject' && path.markerEnd
        ? `url(#${path.markerEnd.id})`
        : undefined,
    ],
    [
      alignment?.type === 'inner' ? 'clip-path' : 'mask',
      alignment && `url(#${alignment.id})`,
    ],
  ];
  const shadow = path.dropShadow
    ? vectorDropShadowToCss(path.dropShadow, mode)
    : undefined;
  const artworkLevel = depth + (shadow ? 2 : 1);
  const blendedFills = path.fillLayers?.some((layer) => layer.blendMode);
  const fillArtwork = path.fillLayers
    ?.map((layer) => {
      const style = layer.blendMode
        ? dialect === 'jsx'
          ? ` style={{ mixBlendMode: ${JSON.stringify(layer.blendMode)} }}`
          : ` style="mix-blend-mode: ${escapeAttribute(layer.blendMode)}"`
        : '';
      return layer.fillImage?.rendering === 'foreignObject'
        ? renderForeignImage(
            layer.fillImage,
            layer.fillOpacity
              ? styleValueToCss(layer.fillOpacity, mode)
              : undefined,
            artworkLevel + (blendedFills ? 1 : 0),
            style,
          )
        : leaf(
            'path',
            [
              ['d', path.d],
              ['fill', fillPaint(layer)],
              ['fill-opacity', paintOpacity(layer)],
              ['fill-rule', path.fillRule],
              ['stroke', 'none'],
            ],
            artworkLevel + (blendedFills ? 1 : 0),
            style,
          );
    })
    .join('\n');
  const isolatedFills = blendedFills
    ? `${pad(artworkLevel)}<g${
        dialect === 'jsx'
          ? ' style={{ isolation: "isolate" }}'
          : ' style="isolation: isolate"'
      }>\n${fillArtwork}\n${pad(artworkLevel)}</g>`
    : fillArtwork;
  const blendedStrokes = path.strokeLayers?.some((layer) => layer.blendMode);
  const strokeArtwork = path.strokeLayers
    ?.map((layer) => {
      const style = layer.blendMode
        ? dialect === 'jsx'
          ? ` style={{ mixBlendMode: ${JSON.stringify(layer.blendMode)} }}`
          : ` style="mix-blend-mode: ${escapeAttribute(layer.blendMode)}"`
        : '';
      return leaf(
        'path',
        [
          ['d', path.d],
          ['fill', 'none'],
          ['stroke', strokePaint(layer)],
          ['stroke-opacity', strokePaintOpacity(layer)],
          [
            'stroke-width',
            alignment ? 2 * (path.strokeWidth ?? 0) : path.strokeWidth,
          ],
          ['stroke-linecap', path.strokeLinecap],
          ['stroke-linejoin', path.strokeLinejoin],
          ['stroke-miterlimit', path.strokeMiterlimit],
          ['stroke-dasharray', path.strokeDasharray],
          ['stroke-dashoffset', path.strokeDashoffset],
          [
            'marker-start',
            layer.markerStart && `url(#${layer.markerStart.id})`,
          ],
          ['marker-end', layer.markerEnd && `url(#${layer.markerEnd.id})`],
          [
            alignment?.type === 'inner' ? 'clip-path' : 'mask',
            alignment && `url(#${alignment.id})`,
          ],
        ],
        artworkLevel + (blendedStrokes ? 1 : 0),
        style,
      );
    })
    .join('\n');
  const isolatedStrokes = blendedStrokes
    ? `${pad(artworkLevel)}<g${
        dialect === 'jsx'
          ? ' style={{ isolation: "isolate" }}'
          : ' style="isolation: isolate"'
      }>\n${strokeArtwork}\n${pad(artworkLevel)}</g>`
    : strokeArtwork;
  const renderBasePath = path.fillLayers
    ? !!path.strokeWidth && !path.strokeLayers
    : fill !== 'none' || !path.strokeLayers;
  const artwork = [
    ...(isolatedFills ? [isolatedFills] : []),
    ...(path.fillImage?.rendering === 'foreignObject'
      ? [
          renderForeignImage(
            path.fillImage,
            path.fillOpacity
              ? styleValueToCss(path.fillOpacity, mode)
              : undefined,
            artworkLevel,
          ),
        ]
      : []),
    ...(renderBasePath ? [leaf('path', pathAttrs, artworkLevel)] : []),
    ...(alignment && !path.strokeLayers
      ? [leaf('path', strokeAttrs, artworkLevel)]
      : []),
    ...(isolatedStrokes ? [isolatedStrokes] : []),
  ].join('\n');
  const shadowStyle = shadow
    ? dialect === 'jsx'
      ? ` style={{ filter: ${JSON.stringify(shadow)} }}`
      : ` style="filter: ${escapeAttribute(shadow)}"`
    : '';
  const content = shadow
    ? `${defs}${pad(depth + 1)}<g${shadowStyle}>\n${artwork}\n${pad(
        depth + 1,
      )}</g>`
    : `${defs}${artwork}`;
  const viewBox = `${formatNumber(path.viewBoxX)} ${formatNumber(
    path.viewBoxY,
  )} ${formatNumber(path.width)} ${formatNumber(path.height)}`;
  return `${pad(depth)}<svg${attr([
    'viewBox',
    viewBox,
  ])} aria-hidden="true"${svgStyle}>\n${content}\n${pad(depth)}</svg>`;
}
