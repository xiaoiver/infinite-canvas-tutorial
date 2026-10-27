const blobUrlPattern =
  /blob:(?:https?:\/\/[^/"'\\\s)<>]+|null)\/[A-Za-z0-9-]+/g;

const imageExtensions: Record<string, string> = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
};

/** Move temporary browser image URLs into the downloadable Vite project. */
export async function bundleBlobAssets(source: string): Promise<{
  source: string;
  files: Record<string, Uint8Array>;
}> {
  const urls = [...new Set(source.match(blobUrlPattern) ?? [])];
  const files: Record<string, Uint8Array> = {};
  let bundledSource = source;

  for (const [index, url] of urls.entries()) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not read image asset: ${url}`);
    const blob = await response.blob();
    const extension = imageExtensions[blob.type.split(';')[0]];
    if (!extension)
      throw new Error(`Unsupported image asset type: ${blob.type}`);
    const path = `assets/canvas-image-${index + 1}.${extension}`;
    files[`public/${path}`] = new Uint8Array(await blob.arrayBuffer());
    bundledSource = bundledSource.split(url).join(`/${path}`);
  }

  return { source: bundledSource, files };
}
