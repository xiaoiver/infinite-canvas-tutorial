import {
  cloneSerializedNodes,
  svgElementsToExtrudedNodes,
  type SerializedNode,
} from '@infinite-canvas-tutorial/ecs';

type Affine = { a: number; b: number; c: number; d: number; e: number; f: number };
const identity: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function multiply(parent: Affine, child: Affine): Affine {
  return {
    a: parent.a * child.a + parent.c * child.b,
    b: parent.b * child.a + parent.d * child.b,
    c: parent.a * child.c + parent.c * child.d,
    d: parent.b * child.c + parent.d * child.d,
    e: parent.a * child.e + parent.c * child.f + parent.e,
    f: parent.b * child.e + parent.d * child.f + parent.f,
  };
}

/** Bounds of actual imported artwork, including nested group transforms. */
function artworkBounds(nodes: SerializedNode[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const transforms = new Map<string, Affine>();
  const visiting = new Set<string>();
  const worldTransform = (node: SerializedNode): Affine | undefined => {
    const cached = transforms.get(node.id);
    if (cached) return cached;
    if (visiting.has(node.id)) return;
    visiting.add(node.id);
    const parent = node.parentId && byId.get(node.parentId);
    const parentTransform = parent ? worldTransform(parent) : identity;
    visiting.delete(node.id);
    if (!parentTransform) return;
    const angle = node.rotation ?? 0;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const sx = node.scaleX ?? 1, sy = node.scaleY ?? 1;
    const matrix = multiply(parentTransform, {
      a: cos * sx, b: sin * sx, c: -sin * sy, d: cos * sy,
      e: node.x ?? 0, f: node.y ?? 0,
    });
    transforms.set(node.id, matrix);
    return matrix;
  };

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes) {
    if (node.type === 'g' || node.visibility === 'hidden' || node.isDeleted) continue;
    const { width, height } = node;
    if (typeof width !== 'number' || typeof height !== 'number' ||
      !Number.isFinite(width) || !Number.isFinite(height) ||
      width <= 0 || height <= 0) continue;
    const matrix = worldTransform(node);
    if (!matrix) continue;
    for (const x of [0, width]) for (const y of [0, height]) {
      const px = matrix.a * x + matrix.c * y + matrix.e;
      const py = matrix.b * x + matrix.d * y + matrix.f;
      if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
      minX = Math.min(minX, px); maxX = Math.max(maxX, px);
      minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    }
  }
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

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

/** Import independent editable layers with their visible artwork centered. */
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
  const bounds = artworkBounds(nodes) ?? viewportBounds(svg);
  const dx = center.x - bounds.x - bounds.width / 2;
  const dy = center.y - bounds.y - bounds.height / 2;
  return nodes.map((node) => node.parentId ? node : {
    ...node,
    x: (node.x ?? 0) + dx,
    y: (node.y ?? 0) + dy,
  } as SerializedNode);
}
