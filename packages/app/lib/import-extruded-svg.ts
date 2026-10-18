import {
  cloneSerializedNodes,
  svgElementsToExtrudedNodes,
  type SerializedNode,
} from '@infinite-canvas-tutorial/ecs';

function viewportBounds(svg: SVGSVGElement) {
  const viewBox = svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  const hasViewBox = viewBox?.length === 4 && viewBox.every(Number.isFinite) &&
    viewBox[2] > 0 && viewBox[3] > 0;
  const pixel = (value: string | null) => value && /^\s*\d+(?:\.\d+)?(?:px)?\s*$/.test(value)
    ? Number.parseFloat(value)
    : undefined;
  const width = pixel(svg.getAttribute('width'));
  const height = pixel(svg.getAttribute('height'));
  if (width && height) return { x: 0, y: 0, width, height };
  if (hasViewBox) return {
    x: viewBox[0], y: viewBox[1], width: viewBox[2], height: viewBox[3],
  };
  return { x: 0, y: 0, width: 480, height: 320 };
}

/** Import independent editable layers centered at a canvas position. */
export function importExtrudedSvg(
  source: string,
  depth: number,
  center: { x: number; y: number },
): SerializedNode[] {
  const document = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (document.documentElement.localName !== 'svg' || document.querySelector('parsererror'))
    throw new Error('Invalid SVG file');
  const svg = document.documentElement as unknown as SVGSVGElement;
  const nodes = cloneSerializedNodes(svgElementsToExtrudedNodes(svg, depth));
  if (!nodes.length) throw new Error('SVG has no importable shapes');
  const bounds = viewportBounds(svg);
  const dx = center.x - bounds.x - bounds.width / 2;
  const dy = center.y - bounds.y - bounds.height / 2;
  return nodes.map((node) => node.parentId ? node : {
    ...node,
    x: (node.x ?? 0) + dx,
    y: (node.y ?? 0) + dy,
  } as SerializedNode);
}
