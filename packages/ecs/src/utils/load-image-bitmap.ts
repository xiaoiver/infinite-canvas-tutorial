import { load } from '@loaders.gl/core';
import { ImageLoader } from '@loaders.gl/images';

/** 动态加载，避免 SSR/Node（如 VitePress build）执行 heic2any 顶层对 `window` 的访问。 */
type Heic2Any = (options: {
  blob: Blob;
  toType?: 'image/jpeg' | 'image/png' | 'image/gif';
  quality?: number;
}) => Promise<Blob | Blob[]>;

let heic2anyModule: Heic2Any | undefined;

async function getHeic2any(): Promise<Heic2Any> {
  if (!heic2anyModule) {
    const m = await import('heic2any');
    heic2anyModule = m.default;
  }
  return heic2anyModule;
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
 * libheif / heic2any then `createImageBitmap`. Some runtimes fail on PNG output;
 * JPEG is a common fallback.
 */
async function decodeHeicBlob(blob: Blob): Promise<ImageBitmap> {
  const heic2any = await getHeic2any();
  const run = (toType: 'image/png' | 'image/jpeg', quality?: number) =>
    heic2any({
      blob,
      toType,
      quality: toType === 'image/jpeg' ? (quality ?? 0.92) : 1,
    });

  let converted = await run('image/png');
  let out = Array.isArray(converted) ? converted[0] : converted;
  if (out && out.size > 0) {
    try {
      return await createImageBitmap(out);
    } catch {
      // fall through to JPEG
    }
  }
  converted = await run('image/jpeg');
  out = Array.isArray(converted) ? converted[0] : converted;
  if (!out || out.size === 0) {
    throw new Error('heic2any: empty output');
  }
  return createImageBitmap(out);
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
 * Loads HEIC/HEIF (e.g. iOS Live Photo still, `.heic` URLs) via libheif (heic2any),
 * and other raster/SVG formats via loaders.gl.
 */
export async function loadImageBitmapUniversal(
  src: string | Blob | File,
): Promise<ImageBitmap> {
  if (typeof src !== 'string') {
    const name = src instanceof File ? src.name : '';
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
      const ab = await src.arrayBuffer();
      if (isHeicMagic(ab.slice(0, 12))) {
        return decodeHeicBlob(
          new Blob([ab], { type: 'image/heic' }),
        );
      }
      throw err;
    }
  }

  const s = src;

  if (s.startsWith('data:')) {
    const parsed = parseDataUrlBase64(s);
    if (parsed) {
      if (isHeicMime(parsed.mime)) {
        return decodeHeicBlob(
          new Blob([parsed.data], { type: parsed.mime }),
        );
      }
      if (isHeicMagic(parsed.data.slice(0, 12))) {
        return decodeHeicBlob(
          new Blob([parsed.data], { type: 'image/heic' }),
        );
      }
    }
    return (await load(s, ImageLoader)) as ImageBitmap;
  }

  if (s.startsWith('blob:')) {
    const blob = await fetch(s).then((r) => r.blob());
    if (await blobLooksHeic(blob)) {
      return decodeHeicBlob(blob);
    }
    return (await load(blob, ImageLoader)) as ImageBitmap;
  }

  if (looksHeicFromPath(s)) {
    const r = await fetch(s, { mode: 'cors' });
    const blob = await r.blob();
    return decodeHeicBlob(blob);
  }

  try {
    return (await load(s, ImageLoader)) as ImageBitmap;
  } catch (first) {
    const r = await fetch(s, { mode: 'cors' });
    const buf = await r.arrayBuffer();
    if (isHeicMagic(buf)) {
      const ct =
        r.headers.get('content-type')?.split(';')[0]?.trim() ?? 'image/heic';
      return decodeHeicBlob(new Blob([buf], { type: ct }));
    }
    throw first;
  }
}
