import { DOMAdapter } from '../environment/adapter';

export const isBrowser =
  typeof window !== 'undefined' && typeof window.document !== 'undefined';

export function createSVGElement(type: string): SVGElement {
  return DOMAdapter.get()
    .getDocument()
    .createElementNS('http://www.w3.org/2000/svg', type);
}

export function getScale($el: HTMLCanvasElement) {
  const bbox = $el.getBoundingClientRect?.();
  let scaleX = 1;
  let scaleY = 1;

  if ($el && bbox) {
    const { offsetWidth, offsetHeight } = $el;
    if (offsetWidth && offsetHeight) {
      scaleX = bbox.width / offsetWidth;
      scaleY = bbox.height / offsetHeight;
    }
  }
  return {
    scaleX,
    scaleY,
    bbox,
  };
}
