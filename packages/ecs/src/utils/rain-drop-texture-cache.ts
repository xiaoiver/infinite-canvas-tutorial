import { loadImageBitmapUniversal } from './load-image-bitmap';

/** Shared drop sprites for Codrops rain; avoids refetch when post chain rebuilds. */
const bitmapByUrl = new Map<string, Promise<ImageBitmap>>();

export function loadRainDropTextureCached(url: string): Promise<ImageBitmap> {
  const key = url.trim();
  if (!key) {
    return Promise.reject(new Error('rain drop texture URL is empty'));
  }
  let pending = bitmapByUrl.get(key);
  if (!pending) {
    pending = loadImageBitmapUniversal(key).catch((err) => {
      bitmapByUrl.delete(key);
      throw err;
    });
    bitmapByUrl.set(key, pending);
  }
  return pending;
}
