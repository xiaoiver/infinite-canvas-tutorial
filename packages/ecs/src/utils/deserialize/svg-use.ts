import { v4 as uuidv4 } from 'uuid';
import { positivePixelLength, sliceAspectRatio, viewBoxMatrix } from './svg-viewbox';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const SUPPORTED_TARGETS = new Set([
  'g', 'use', 'svg', 'symbol', 'path', 'polygon', 'polyline', 'rect', 'circle', 'ellipse',
]);

function descendants(element: SVGElement): SVGElement[] {
  return [element, ...Array.from(element.querySelectorAll('*')) as SVGElement[]];
}

function pixelOffset(value: string | null): number | undefined {
  if (!value) return 0;
  if (!/^\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?(?:px)?\s*$/.test(value)) return;
  const offset = Number.parseFloat(value);
  return Number.isFinite(offset) ? offset : undefined;
}

/** Materialize a nested SVG or referenced symbol viewport as an editable group. */
function viewportGroup(element: SVGElement, width: number, height: number): SVGElement | undefined {
  const viewport = viewBoxMatrix(element, width, height);
  if (!viewport) return;
  const x = pixelOffset(element.getAttribute('x'));
  const y = pixelOffset(element.getAttribute('y'));
  if (x === undefined || y === undefined) return;
  const group = element.ownerDocument.createElementNS(SVG_NS, 'g') as SVGElement;
  for (const attribute of Array.from(element.attributes)) {
    if (!['viewBox', 'preserveAspectRatio', 'x', 'y', 'width', 'height'].includes(attribute.name))
      group.setAttribute(attribute.name, attribute.value);
  }
  group.setAttribute('data-svg-use-instance', '');
  const { a, b, c, d, e, f } = viewport;
  const transform = group.getAttribute('transform') || '';
  const translate = x || y ? `translate(${x} ${y})` : '';
  const outerTransform = [transform, translate].filter(Boolean).join(' ');
  const overflow = element.style?.overflow || element.getAttribute('overflow');
  const clip = overflow === 'hidden' || overflow === 'scroll' ||
    (overflow !== 'visible' && overflow !== 'auto' &&
      (element.localName === 'svg' || sliceAspectRatio(element)));
  if (clip) {
    group.setAttribute('data-svg-viewport', `${width} ${height}`);
    if (outerTransform) group.setAttribute('data-svg-viewport-transform', outerTransform);
  }
  group.setAttribute('transform', [outerTransform, `matrix(${a} ${b} ${c} ${d} ${e} ${f})`]
    .filter(Boolean).join(' '));
  // Keep the definition intact for a later <use> that references this SVG.
  for (const child of Array.from(element.children)) group.appendChild(child.cloneNode(true));
  return group;
}

/** Expand local SVG use instances before the ordinary and extrusion importers run. */
export function expandSvgUses(
  input: SVGSVGElement | SVGElement[],
  extraDefinitions: SVGElement[] = [],
): { root?: SVGSVGElement; children: SVGElement[] } {
  const sourceChildren = Array.isArray(input)
    ? input
    : Array.from(input.children) as SVGElement[];
  if (!sourceChildren.some((child) =>
    child.localName === 'use' || child.localName === 'svg' ||
    child.querySelector('use, svg')))
    return Array.isArray(input) ? { children: input } : { root: input, children: sourceChildren };

  const root = Array.isArray(input) ? undefined : input.cloneNode(true) as SVGSVGElement;
  const children = root
    ? Array.from(root.children) as SVGElement[]
    : sourceChildren.map((child) => child.cloneNode(true) as SVGElement);
  const definitions = new Map<string, SVGElement>();
  const occupied = new Set<string>();
  for (const source of [...children, ...extraDefinitions]) {
    for (const element of descendants(source)) {
      if (element.id) {
        definitions.set(element.id, element);
        occupied.add(element.id);
      }
    }
  }

  function uniqueId(base: string): string {
    let id = base;
    for (let suffix = 2; occupied.has(id); suffix++) id = `${base}-${suffix}`;
    occupied.add(id);
    return id;
  }

  function expand(element: SVGElement, stack: Set<string>): SVGElement | undefined {
    if (element.localName === 'use') {
      const href = element.getAttribute('href') ||
        element.getAttributeNS(XLINK_NS, 'href') ||
        element.getAttribute('xlink:href');
      if (!href?.startsWith('#')) return;
      const targetId = href.slice(1);
      const target = definitions.get(targetId);
      if (!target || !SUPPORTED_TARGETS.has(target.localName) || stack.has(targetId))
        return;

      const x = pixelOffset(element.getAttribute('x'));
      const y = pixelOffset(element.getAttribute('y'));
      if (x === undefined || y === undefined) return;
      const wrapper = element.ownerDocument.createElementNS(SVG_NS, 'g') as SVGElement;
      const instanceId = element.id || uniqueId(`use-${uuidv4()}`);
      wrapper.id = instanceId;
      wrapper.setAttribute('data-svg-use-instance', '');
      for (const attribute of Array.from(element.attributes)) {
        if (!['id', 'href', 'xlink:href', 'x', 'y', 'width', 'height', 'transform']
          .includes(attribute.name))
          wrapper.setAttribute(attribute.name, attribute.value);
      }
      const transform = element.getAttribute('transform') || '';
      const translate = x || y ? `translate(${x} ${y})` : '';
      if (transform || translate)
        wrapper.setAttribute('transform', [transform, translate].filter(Boolean).join(' '));

      let clone = target.cloneNode(true) as SVGElement;
      if (target.localName === 'symbol' || target.localName === 'svg') {
        const width = positivePixelLength(
          element.getAttribute('width') ?? target.getAttribute('width'),
        );
        const height = positivePixelLength(
          element.getAttribute('height') ?? target.getAttribute('height'),
        );
        if (!width || !height) return;
        const group = viewportGroup(clone, width, height);
        if (!group) return;
        clone = group;
      }
      const remapped = new Map<string, string>();
      for (const part of descendants(clone)) {
        if (part.localName === 'g')
          part.setAttribute('data-svg-use-instance', '');
        if (!part.id) continue;
        const newId = uniqueId(`${instanceId}--${part.id}`);
        remapped.set(part.id, newId);
        part.id = newId;
      }
      for (const part of descendants(clone)) {
        for (const attribute of Array.from(part.attributes)) {
          const rewritten = attribute.value.replace(/url\(#([^)]+)\)/g,
            (match, id: string) => remapped.has(id) ? `url(#${remapped.get(id)})` : match);
          if (rewritten !== attribute.value)
            part.setAttribute(attribute.name, rewritten);
        }
      }
      const nestedStack = new Set(stack).add(targetId);
      const expanded = expand(clone, nestedStack);
      if (!expanded) return;
      wrapper.appendChild(expanded);
      return wrapper;
    }

    if (element.localName !== 'defs') {
      const width = positivePixelLength(element.getAttribute('width'));
      const height = positivePixelLength(element.getAttribute('height'));
      const current = element.localName === 'svg' && width && height
        ? viewportGroup(element, width, height) ?? element
        : element;
      for (const child of Array.from(current.children) as SVGElement[]) {
        const expanded = expand(child, stack);
        if (expanded) child.replaceWith(expanded);
        else child.remove();
      }
      return current;
    }
    return element;
  }

  const expandedChildren = children.flatMap((child) => {
    const expanded = expand(child, new Set());
    if (root) {
      if (expanded) child.replaceWith(expanded);
      else child.remove();
    }
    return expanded ? [expanded] : [];
  });
  return { root, children: expandedChildren };
}
