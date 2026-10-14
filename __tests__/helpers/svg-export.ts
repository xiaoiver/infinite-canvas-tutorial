import { createCanvas, loadImage } from 'canvas';
import { JSDOM } from 'jsdom';
import { DOMAdapter } from '../../packages/ecs/src/environment';
import type { Adapter } from '../../packages/ecs/src/environment/adapter';
import { serializeNodesToSVGElements } from '../../packages/ecs/src/utils/serialize/svg';
import type { SerializedNode } from '../../packages/ecs/src/types/serialized-node';

/** Real DOM and image decoding without an ECS world or a GPU render loop. */
export function svgExportFixture() {
  const dom = new JSDOM();
  const previous = DOMAdapter.get();
  DOMAdapter.set({
    getDocument: () => dom.window.document,
    getXMLSerializer: () => new dom.window.XMLSerializer(),
    createCanvas: (width: number, height: number) =>
      createCanvas(width, height),
    createImage: (source: string) => loadImage(source),
    splitGraphemes: (text: string) => Array.from(text),
  } as unknown as Adapter);
  return {
    async export(nodes: SerializedNode[]): Promise<SVGSVGElement> {
      const svg = dom.window.document.createElementNS(
        'http://www.w3.org/2000/svg',
        'svg',
      );
      svg.append(...(await serializeNodesToSVGElements(nodes)));
      return svg;
    },
    dispose() {
      DOMAdapter.set(previous);
      dom.window.close();
    },
  };
}

export function checkerImage() {
  const canvas = createCanvas(8, 4);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(0, 0, 4, 4);
  ctx.fillStyle = '#0000ff';
  ctx.fillRect(4, 0, 4, 4);
  return canvas.toDataURL();
}

export function paintReference(
  svg: SVGElement,
  element: Element,
  name: string,
) {
  const reference = element.getAttribute(name);
  expect(reference).toMatch(/^url\(#[^)]+\)$/);
  const id = reference!.slice(5, -1);
  const definitions = Array.from(svg.querySelectorAll('[id]')).filter(
    (definition) => definition.id === id,
  );
  expect(definitions).toHaveLength(1);
  return definitions[0];
}

export async function rasterizeSvg(svg: SVGElement) {
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', '180');
  svg.setAttribute('height', '120');
  const image = await loadImage(Buffer.from(svg.outerHTML));
  const canvas = createCanvas(180, 120);
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  return {
    pixel: (x: number, y: number) =>
      Array.from(context.getImageData(x, y, 1, 1).data),
    pixels: () => context.getImageData(0, 0, 180, 120).data,
  };
}
