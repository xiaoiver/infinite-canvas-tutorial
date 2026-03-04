import { fontWeightMap } from '../..';
import type { SerializedNode } from '../../types/serialized-node';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Font descriptor key for matching document.fonts.
 * @see https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/scene/export.ts#L429-L431
 */
function fontKey(
  family: string,
  weight: string = 'normal',
  style: string = 'normal',
): string {
  return `${family}|${weight}|${style}`;
}

/**
 * Collect unique font descriptors from text nodes.
 */
function collectFontKeys(nodes: SerializedNode[]): Set<string> {
  const keys = new Set<string>();
  for (const node of nodes) {
    if (node.type !== 'text') continue;
    const family = (node as { fontFamily?: string }).fontFamily ?? 'sans-serif';
    const weight = `${(node as { fontWeight?: string | number }).fontWeight ?? 'normal'}`;
    // 将 weight 字面量转换成绝对值，例如 normal -> 400, bold -> 700
    const weightValue = fontWeightMap[weight as keyof typeof fontWeightMap] ?? 400;
    const style = (node as { fontStyle?: string }).fontStyle ?? 'normal';
    keys.add(fontKey(family, `${weightValue}`, style));
  }
  return keys;
}

/**
 * Map blob type to CSS format() value.
 */
function blobFormat(blob: Blob): string {
  const t = blob.type.toLowerCase();
  if (t.includes('woff2')) return 'woff2';
  if (t.includes('woff')) return 'woff';
  if (t.includes('truetype') || t.includes('ttf')) return 'truetype';
  if (t.includes('opentype') || t.includes('otf')) return 'opentype';
  return 'woff2';
}

/**
 * Generate @font-face CSS declarations for fonts used by the given nodes.
 * Uses the browser Font Face Set API to serialize loaded fonts as data URLs,
 * so exported SVG is self-contained and renders the same elsewhere.
 *
 * @param nodes - Serialized nodes (text nodes define fontFamily / fontWeight / fontStyle)
 * @param doc - Document for creating elements and accessing document.fonts (optional in non-browser)
 * @returns Array of @font-face CSS strings; empty if not in browser or no fonts match
 *
 * @see https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/scene/export.ts#L429-L431
 */
export async function generateFontFaceDeclarations(
  nodes: SerializedNode[],
  doc?: Document,
): Promise<string[]> {
  const document = doc ?? (typeof globalThis !== 'undefined' && (globalThis as any).document);
  if (!document?.fonts) return [];

  const wanted = collectFontKeys(nodes);
  if (wanted.size === 0) return [];

  await document.fonts.ready;
  const declarations: string[] = [];
  const seen = new Set<string>();

  for (const fontFace of document.fonts.values()) {
    const family = (fontFace as FontFace).family;
    const weight = (fontFace as FontFace).weight ?? 'normal';
    const style = (fontFace as FontFace).style ?? 'normal';
    const key = fontKey(family, String(weight), style);
    if (!wanted.has(key) || seen.has(key)) continue;

    try {
      debugger;
      // @ts-expect-error
      const blob = await (fontFace as FontFace).blob();
      if (!blob || blob.size === 0) continue;
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const base64 = btoa(binary);
      const format = blobFormat(blob);
      const mime =
        format === 'woff2'
          ? 'font/woff2'
          : format === 'woff'
            ? 'font/woff'
            : blob.type || 'font/woff2';
      const src = `url(data:${mime};base64,${base64}) format("${format}")`;
      declarations.push(
        `@font-face{font-family:"${family.replace(/"/g, '\\"')}";font-weight:${weight};font-style:${style};src:${src};}`,
      );
      seen.add(key);
    } catch {
      // Skip this face if blob() fails (e.g. system font or CORS)
    }
  }

  return declarations;
}

const DELIMITER = '\n      ';

/**
 * Create a <style> element containing inline @font-face rules for the given nodes,
 * suitable for appending to SVG <defs>. Uses Excalidraw-style delimiter for readability.
 *
 * @see https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/scene/export.ts#L429-L436
 */
export async function createFontFacesStyleElement(
  nodes: SerializedNode[],
  doc: Document,
): Promise<SVGStyleElement | null> {
  const fontFaces = await generateFontFaceDeclarations(nodes, doc);
  if (fontFaces.length === 0) return null;

  const style = doc.createElementNS(SVG_NS, 'style');
  style.classList.add('style-fonts');
  style.appendChild(
    doc.createTextNode(`${DELIMITER}${fontFaces.join(DELIMITER)}`),
  );
  return style;
}
