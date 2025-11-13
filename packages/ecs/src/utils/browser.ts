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

export const getSandboxPermissions = (permissions: TLEmbedShapePermissions) => {
  return Object.entries(permissions)
    .filter(([_perm, isEnabled]) => isEnabled)
    .map(([perm]) => perm)
    .join(' ');
};

type TLEmbedShapePermissions = {
  [K in keyof typeof embedShapePermissionDefaults]?: boolean;
};
/**
 * Permissions with note inline from
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#attr-sandbox
 *
 * @see https://github.com/tldraw/tldraw/blob/main/packages/tldraw/src/lib/defaultEmbedDefinitions.ts#L606
 */
export const embedShapePermissionDefaults = {
  // ========================================================================================
  // Disabled permissions
  // ========================================================================================
  // [MDN] Experimental: Allows for downloads to occur without a gesture from the user.
  // [REASON] Disabled because otherwise the <iframe/> can trick the user on behalf of us to perform an action.
  'allow-downloads-without-user-activation': false,
  // [MDN] Allows for downloads to occur with a gesture from the user.
  // [REASON] Disabled because otherwise the <iframe/> can trick the user on behalf of us to perform an action.
  'allow-downloads': false,
  // [MDN] Lets the resource open modal windows.
  // [REASON] The <iframe/> could 'window.prompt("Enter your tldraw password")'.
  'allow-modals': false,
  // [MDN] Lets the resource lock the screen orientation.
  // [REASON] Would interfere with the tldraw interface.
  'allow-orientation-lock': false,
  // [MDN] Lets the resource use the Pointer Lock API.
  // [REASON] Maybe we should allow this for games embeds (scratch/codepen/codesandbox).
  'allow-pointer-lock': false,
  // [MDN] Allows popups (such as window.open(), target="_blank", or showModalDialog()). If this keyword is not used, the popup will silently fail to open.
  // [REASON] We want to allow embeds to link back to their original sites (e.g. YouTube).
  'allow-popups': true,
  // [MDN] Lets the sandboxed document open new windows without those windows inheriting the sandboxing. For example, this can safely sandbox an advertisement without forcing the same restrictions upon the page the ad links to.
  // [REASON] We shouldn't allow popups as a embed could pretend to be us by opening a mocked version of tldraw. This is very unobvious when it is performed as an action within our app.
  'allow-popups-to-escape-sandbox': false,
  // [MDN] Lets the resource start a presentation session.
  // [REASON] Prevents embed from navigating away from tldraw and pretending to be us.
  'allow-presentation': false,
  // [MDN] Experimental: Lets the resource request access to the parent's storage capabilities with the Storage Access API.
  // [REASON] We don't want anyone else to access our storage.
  'allow-storage-access-by-user-activation': false,
  // [MDN] Lets the resource navigate the top-level browsing context (the one named _top).
  // [REASON] Prevents embed from navigating away from tldraw and pretending to be us.
  'allow-top-navigation': false,
  // [MDN] Lets the resource navigate the top-level browsing context, but only if initiated by a user gesture.
  // [REASON] Prevents embed from navigating away from tldraw and pretending to be us.
  'allow-top-navigation-by-user-activation': false,
  // ========================================================================================
  // Enabled permissions
  // ========================================================================================
  // [MDN] Lets the resource run scripts (but not create popup windows).
  'allow-scripts': true,
  // [MDN] If this token is not used, the resource is treated as being from a special origin that always fails the same-origin policy (potentially preventing access to data storage/cookies and some JavaScript APIs).
  'allow-same-origin': true,
  // [MDN] Allows the resource to submit forms. If this keyword is not used, form submission is blocked.
  'allow-forms': true,
} as const;
