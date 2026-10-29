import type { Pattern } from '../pattern';
import { parsePatternTransform } from '../pattern-transform';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const TILE_SHAPES = new Set([
  'g', 'rect', 'circle', 'ellipse', 'path', 'polygon', 'polyline', 'line', 'image',
]);
const MAX_REFERENCE_DEPTH = 12;
const MAX_TILE_ELEMENTS = 256;
const MAX_TILE_MARKUP = 1_000_000;
const MAX_EMBEDDED_IMAGE_URL = 750_000;
const LOCAL_PAINT = /^url\(\s*#([\w.-]+)\s*\)$/i;
const EMBEDDED_IMAGE = /^data:image\/(?:png|jpe?g|webp|avif);base64,[a-z0-9+/=]+$/i;

function localHref(element: SVGElement): string | null {
  return element.getAttribute('href') ??
    element.getAttributeNS(XLINK_NS, 'href') ??
    element.getAttribute('xlink:href');
}

function findLocalReference(
  element: SVGElement,
  id: string,
  definitions: SVGElement[],
): SVGElement | undefined {
  const root = element.closest('svg');
  const inRoot = root && [root, ...Array.from(root.querySelectorAll('[id]'))]
    .find((candidate) => candidate.id === id);
  if (inRoot) return inRoot as SVGElement;
  for (const definition of definitions) {
    if (definition.id === id) return definition;
    const nested = Array.from(definition.querySelectorAll('[id]'))
      .find((candidate) => candidate.id === id);
    if (nested) return nested as SVGElement;
  }
  return undefined;
}

interface PatternDefinition {
  width: string | null;
  height: string | null;
  x: string | null;
  y: string | null;
  units: string | null;
  contentUnits: string | null;
  transform: string | null;
  children: SVGElement[];
}

function resolvePatternDefinition(
  pattern: SVGElement,
  definitions: SVGElement[],
  visited = new Set<SVGElement>(),
): PatternDefinition | undefined {
  if (pattern.localName !== 'pattern' || visited.size >= MAX_REFERENCE_DEPTH ||
      visited.has(pattern) || pattern.hasAttribute('viewBox')) return undefined;
  visited.add(pattern);
  const href = localHref(pattern);
  let inherited: PatternDefinition | undefined;
  if (href !== null) {
    if (!href.startsWith('#') || href.length <= 1) return undefined;
    const base = findLocalReference(pattern, href.slice(1), definitions);
    if (!base || base.localName !== 'pattern') return undefined;
    inherited = resolvePatternDefinition(base, definitions, visited);
    if (!inherited) return undefined;
  }
  const read = (name: string, fallback: string | null | undefined) =>
    pattern.getAttribute(name) ?? fallback ?? null;
  return {
    width: read('width', inherited?.width),
    height: read('height', inherited?.height),
    x: read('x', inherited?.x),
    y: read('y', inherited?.y),
    units: read('patternUnits', inherited?.units),
    contentUnits: read('patternContentUnits', inherited?.contentUnits),
    transform: read('patternTransform', inherited?.transform),
    children: pattern.children.length
      ? Array.from(pattern.children) as SVGElement[]
      : inherited?.children ?? [],
  };
}

function pixelOffset(raw: string | null): number | undefined {
  if (raw === null) return 0;
  if (!/^\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?(?:px)?\s*$/.test(raw))
    return undefined;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : undefined;
}

function expandTileElement(
  element: SVGElement,
  definitions: SVGElement[],
  stack: Set<string>,
  count: { value: number },
): SVGElement | undefined {
  if (++count.value > MAX_TILE_ELEMENTS || stack.size > MAX_REFERENCE_DEPTH)
    return undefined;
  if (element.localName === 'use') {
    const href = localHref(element);
    if (!href?.startsWith('#') || href.length <= 1) return undefined;
    const id = href.slice(1);
    if (stack.has(id)) return undefined;
    const target = findLocalReference(element, id, definitions);
    if (!target || !TILE_SHAPES.has(target.localName)) return undefined;
    const x = pixelOffset(element.getAttribute('x'));
    const y = pixelOffset(element.getAttribute('y'));
    if (x === undefined || y === undefined) return undefined;
    const group = element.ownerDocument.createElementNS(SVG_NS, 'g') as SVGElement;
    for (const { name, localName, value } of Array.from(element.attributes)) {
      if (localName !== 'href' &&
          !['id', 'x', 'y', 'width', 'height', 'transform'].includes(name))
        group.setAttribute(name, value);
    }
    const transform = [element.getAttribute('transform'),
      x || y ? `translate(${x} ${y})` : ''].filter(Boolean).join(' ');
    if (transform) group.setAttribute('transform', transform);
    const expanded = expandTileElement(target, definitions, new Set(stack).add(id), count);
    if (!expanded) return undefined;
    group.appendChild(expanded);
    return group;
  }
  if (!TILE_SHAPES.has(element.localName)) return undefined;
  const clone = element.cloneNode(false) as SVGElement;
  for (const child of Array.from(element.children) as SVGElement[]) {
    const expanded = expandTileElement(child, definitions, stack, count);
    if (!expanded) return undefined;
    clone.appendChild(expanded);
  }
  return clone;
}

function collectTilePaintRefs(children: SVGElement[]): Set<string> | undefined {
  const refs = new Set<string>();
  for (const child of children) {
    for (const part of [child, ...Array.from(child.querySelectorAll('*'))] as SVGElement[]) {
      for (const attr of Array.from(part.attributes)) {
        const { localName, value } = attr;
        if (/^on/i.test(localName) || /currentcolor/i.test(value)) return undefined;
        if (localName === 'href') {
          if (part.localName !== 'image' || value.length > MAX_EMBEDDED_IMAGE_URL ||
              !EMBEDDED_IMAGE.test(value)) return undefined;
          continue;
        }
        if (localName === 'fill' || localName === 'stroke') {
          const paint = LOCAL_PAINT.exec(value);
          if (paint) {
            refs.add(paint[1]);
            continue;
          }
        }
        if (/url\s*\(/i.test(value)) return undefined;
      }
    }
  }
  return refs;
}

function collectGradientDefinition(
  id: string,
  owner: SVGElement,
  definitions: SVGElement[],
  collected: Map<string, SVGElement>,
  visiting = new Set<string>(),
): boolean {
  if (collected.has(id)) return true;
  if (visiting.has(id) || visiting.size >= MAX_REFERENCE_DEPTH ||
      collected.size >= MAX_TILE_ELEMENTS) return false;
  const target = findLocalReference(owner, id, definitions);
  if (!target || !['linearGradient', 'radialGradient'].includes(target.localName) ||
      Array.from(target.children).some((child) =>
        child.localName !== 'stop' || child.children.length > 0) ||
      target.children.length > MAX_TILE_ELEMENTS) return false;
  for (const part of [target, ...Array.from(target.querySelectorAll('*'))] as SVGElement[]) {
    for (const attr of Array.from(part.attributes)) {
      if (/^on/i.test(attr.localName) || /url\s*\(|currentcolor/i.test(attr.value))
        return false;
      if (attr.localName === 'href' && !/^#[\w.-]+$/.test(attr.value))
        return false;
    }
  }
  visiting.add(id);
  const inherited = localHref(target);
  if (inherited && !collectGradientDefinition(
    inherited.slice(1), target, definitions, collected, visiting,
  )) return false;
  visiting.delete(id);
  collected.set(id, target.cloneNode(true) as SVGElement);
  return true;
}

/** Embed safe local SVG references in a self-contained, editable pattern tile. */
export function deserializePattern(
  element: SVGElement,
  definitions: SVGElement[],
): Pattern | undefined {
  const resolved = resolvePatternDefinition(element, definitions);
  if (!resolved || resolved.units !== 'userSpaceOnUse' ||
      (resolved.contentUnits ?? 'userSpaceOnUse') !== 'userSpaceOnUse') return undefined;
  const transform = resolved.transform ?? undefined;
  if (transform && !parsePatternTransform(transform)) return undefined;
  const width = Number(resolved.width);
  const height = Number(resolved.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) ||
      width <= 0 || height <= 0 || width > 1024 || height > 1024 ||
      !Number.isInteger(width) || !Number.isInteger(height)) return undefined;
  const x = Number(resolved.x ?? 0);
  const y = Number(resolved.y ?? 0);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  const count = { value: 0 };
  const children = resolved.children.map((child) =>
    expandTileElement(child, definitions, new Set(), count));
  if (!children.length || children.some((child) => !child)) return undefined;
  const paintRefs = collectTilePaintRefs(children as SVGElement[]);
  if (!paintRefs) return undefined;
  const tile = element.ownerDocument.createElementNS(SVG_NS, 'svg');
  tile.setAttribute('width', String(width));
  tile.setAttribute('height', String(height));
  tile.setAttribute('viewBox', `0 0 ${width} ${height}`);
  if (paintRefs.size) {
    const gradients = new Map<string, SVGElement>();
    for (const id of paintRefs) {
      if (!collectGradientDefinition(id, element, definitions, gradients))
        return undefined;
    }
    const defs = element.ownerDocument.createElementNS(SVG_NS, 'defs');
    for (const gradient of gradients.values()) defs.appendChild(gradient);
    tile.appendChild(defs);
  }
  for (const child of children) tile.appendChild(child!);
  const serializer = element.ownerDocument.defaultView?.XMLSerializer ?? XMLSerializer;
  const markup = new serializer().serializeToString(tile);
  if (markup.length > MAX_TILE_MARKUP) return undefined;
  return {
    image: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`,
    repetition: 'repeat',
    transform: [transform, x || y ? `translate(${x} ${y})` : '']
      .filter(Boolean).join(' '),
  };
}
