import { loadImageBitmapUniversal } from './load-image-bitmap';

/** Shared drop sprites for Codrops rain; avoids refetch when post chain rebuilds. */
const bitmapByUrl = new Map<string, Promise<ImageBitmap>>();

/** Resolved bitmaps for synchronous post-chain init (e.g. PNG export). */
const bitmapReadyByUrl = new Map<string, ImageBitmap>();

export function getRainDropTextureBitmapIfReady(url: string): ImageBitmap | undefined {
  return bitmapReadyByUrl.get(url.trim());
}

export function loadRainDropTextureCached(url: string): Promise<ImageBitmap> {
  const key = url.trim();
  if (!key) {
    return Promise.reject(new Error('rain drop texture URL is empty'));
  }
  const ready = bitmapReadyByUrl.get(key);
  if (ready) {
    return Promise.resolve(ready);
  }
  let pending = bitmapByUrl.get(key);
  if (!pending) {
    pending = loadImageBitmapUniversal(key)
      .then((bmp) => {
        bitmapReadyByUrl.set(key, bmp);
        return bmp;
      })
      .catch((err) => {
        bitmapByUrl.delete(key);
        throw err;
      });
    bitmapByUrl.set(key, pending);
  }
  return pending;
}

/** Await Codrops drop sprites before raster export so `createPostProcessing` can init synchronously. */
export async function preloadRainDropTextures(urls: string[]): Promise<void> {
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  if (unique.length === 0) {
    return;
  }
  await Promise.all(unique.map((u) => loadRainDropTextureCached(u)));
}
