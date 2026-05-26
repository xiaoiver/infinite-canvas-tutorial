const bitmapByUrl = new Map<string, ImageBitmap>();
const loadingByUrl = new Map<string, Promise<ImageBitmap>>();

export function getRaindropSpriteBitmapIfReady(url: string): ImageBitmap | undefined {
  return bitmapByUrl.get(url.trim());
}

export async function loadRaindropSpriteCached(url: string): Promise<ImageBitmap> {
  const key = url.trim();
  const cached = bitmapByUrl.get(key);
  if (cached) {
    return cached;
  }
  let pending = loadingByUrl.get(key);
  if (!pending) {
    pending = (async () => {
      const res = await fetch(key);
      if (!res.ok) {
        throw new Error(`raindrop sprite: failed to load ${key} (${res.status})`);
      }
      const blob = await res.blob();
      const bmp = await createImageBitmap(blob);
      bitmapByUrl.set(key, bmp);
      loadingByUrl.delete(key);
      return bmp;
    })();
    loadingByUrl.set(key, pending);
  }
  return pending;
}

export async function preloadRaindropSprites(urls: string[]): Promise<void> {
  await Promise.all(urls.map((u) => loadRaindropSpriteCached(u)));
}
