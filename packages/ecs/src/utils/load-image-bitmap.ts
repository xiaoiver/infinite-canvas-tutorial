import { load } from '@loaders.gl/core';
import { ImageLoader } from '@loaders.gl/images';

/** Keep HEIC conversion lazy; its background worker starts on first decode. */
type HeicConverter = typeof import('heic-to')['heicTo'];

let heicToModule: HeicConverter | undefined;

async function getHeicConverter(): Promise<HeicConverter> {
  if (!heicToModule) {
    const m = await import('heic-to');
    heicToModule = m.heicTo;
  }
  return heicToModule;
}

function isHeicMime(mime: string): boolean {
  return /^image\/hei[cf](?:-sequence)?$/i.test(mime.trim());
}

function looksHeicFromPath(url: string): boolean {
  try {
    const u = new URL(url, 'https://placeholder.invalid');
    return /\.hei[cf]$/i.test(u.pathname);
  } catch {
    return /\.hei[cf](\?|#|$)/i.test(url);
  }
}

function isHeicMagic(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 12) return false;
  const u = new Uint8Array(buf);
  const ftyp = String.fromCharCode(u[4], u[5], u[6], u[7]);
  if (ftyp !== 'ftyp') return false;
  const brand = String.fromCharCode(u[8], u[9], u[10], u[11]);
  if (/^(avif|avis)/i.test(brand)) {
    return false;
  }
  return /^(heic|heix|hevc|hevx|mif1|msf1|hevm|hevs)/i.test(brand);
}

async function blobLooksHeic(blob: Blob): Promise<boolean> {
  if (isHeicMime(blob.type)) {
    return true;
  }
  const head = await blob.slice(0, 16).arrayBuffer();
  return isHeicMagic(head);
}

/**
 * libheif / heic-to then `createImageBitmap`. Some runtimes fail on PNG output;
 * JPEG is a common fallback.
 */
async function decodeHeicBlob(blob: Blob): Promise<ImageBitmap> {
  const heicTo = await getHeicConverter();
  const run = (type: 'image/png' | 'image/jpeg') =>
    heicTo({
      blob,
      type,
      quality: type === 'image/jpeg' ? 0.92 : 1,
    });

  try {
    const out = await run('image/png');
    if (out && out.size > 0) {
      return await createImageBitmap(out);
    }
  } catch {
    // Both PNG conversion and browser decoding can fail. Retry as JPEG once.
  }
  const out = await run('image/jpeg');
  if (!out || out.size === 0) {
    throw new Error('heic-to: empty output');
  }
  return createImageBitmap(out);
}

async function fetchImageBlob(src: string): Promise<Blob> {
  const response = await fetch(src, { mode: 'cors' });
  if (!response.ok) {
    throw new Error(`Image request failed: HTTP ${response.status}`);
  }
  return response.blob();
}

/**
 * `data:…;base64,…` only (typical for pasted / exported stills).
 * Handles `application/octet-stream` + HEIC bytes (some tools strip `image/heic`).
 */
function parseDataUrlBase64(
  s: string,
): { mime: string; data: ArrayBuffer } | null {
  if (!s.startsWith('data:')) {
    return null;
  }
  const comma = s.indexOf(',');
  if (comma < 0) {
    return null;
  }
  const header = s.substring(5, comma);
  if (!/;base64/i.test(header)) {
    return null;
  }
  const mime = header.split(';')[0]!.trim() || 'text/plain';
  const b64 = s.slice(comma + 1).replace(/\s/g, '');
  try {
    const bin = atob(b64);
    const n = bin.length;
    const u = new Uint8Array(n);
    for (let i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    return { mime, data: u.buffer };
  } catch {
    return null;
  }
}

/**
 * Loads HEIC/HEIF (e.g. iOS Live Photo still, `.heic` URLs) via libheif (heic-to),
 * and other raster/SVG formats via loaders.gl.
 */
export async function loadImageBitmapUniversal(
  src: string | Blob | File,
): Promise<ImageBitmap> {
  if (typeof src !== 'string') {
    const name =
      typeof File !== 'undefined' && src instanceof File ? src.name : '';
    if (isHeicMime(src.type) || /\.hei[cf]$/i.test(name)) {
      return decodeHeicBlob(src);
    }
    if (!src.type || src.type === 'application/octet-stream') {
      if (await blobLooksHeic(src)) {
        return decodeHeicBlob(src);
      }
    }
    try {
      return (await load(src, ImageLoader)) as ImageBitmap;
    } catch (err) {
      let heic = false;
      try {
        heic = await blobLooksHeic(src);
      } catch {
        // A failed signature probe must not hide the original decoder error.
      }
      if (heic) return decodeHeicBlob(new Blob([src], { type: 'image/heic' }));
      throw err;
    }
  }

  const s = src;

  if (s.startsWith('data:')) {
    const parsed = parseDataUrlBase64(s);
    if (parsed) {
      if (isHeicMime(parsed.mime)) {
        return decodeHeicBlob(new Blob([parsed.data], { type: parsed.mime }));
      }
      if (isHeicMagic(parsed.data.slice(0, 12))) {
        return decodeHeicBlob(new Blob([parsed.data], { type: 'image/heic' }));
      }
    }
    return (await load(s, ImageLoader)) as ImageBitmap;
  }

  if (s.startsWith('blob:')) {
    const blob = await fetchImageBlob(s);
    if (await blobLooksHeic(blob)) {
      return decodeHeicBlob(blob);
    }
    return (await load(blob, ImageLoader)) as ImageBitmap;
  }

  if (looksHeicFromPath(s)) {
    return decodeHeicBlob(await fetchImageBlob(s));
  }

  try {
    return (await load(s, ImageLoader)) as ImageBitmap;
  } catch (first) {
    let blob: Blob;
    try {
      blob = await fetchImageBlob(s);
      if (!(await blobLooksHeic(blob))) throw first;
    } catch {
      // This request only diagnoses an unlabelled HEIC source. Preserve the
      // original error when fetching/reading it fails or it is another format.
      throw first;
    }
    return decodeHeicBlob(blob);
  }
}
