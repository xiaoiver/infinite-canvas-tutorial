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

/**
 * Safely parses a URL string without throwing exceptions on invalid input.
 * Returns a URL object for valid URLs or undefined for invalid ones.
 *
 * @param url - The URL string to parse
 * @param baseUrl - Optional base URL to resolve relative URLs against
 * @returns A URL object if parsing succeeds, undefined if it fails
 *
 * @example
 * ```ts
 * // Valid absolute URL
 * const url1 = safeParseUrl('https://example.com')
 * if (url1) {
 *   console.log(`Valid URL: ${url1.href}`) // "Valid URL: https://example.com/"
 * }
 *
 * // Invalid URL
 * const url2 = safeParseUrl('not-a-url')
 * console.log(url2) // undefined
 *
 * // Relative URL with base
 * const url3 = safeParseUrl('/path', 'https://example.com')
 * if (url3) {
 *   console.log(url3.href) // "https://example.com/path"
 * }
 *
 * // Error handling
 * function handleUserUrl(input: string) {
 *   const url = safeParseUrl(input)
 *   if (url) {
 *     return url
 *   } else {
 *     console.log('Invalid URL provided')
 *     return null
 *   }
 * }
 * ```
 *
 * @public
 */
export const safeParseUrl = (url: string, baseUrl?: string | URL) => {
  try {
    return new URL(url, baseUrl);
  } catch {
    return;
  }
};
