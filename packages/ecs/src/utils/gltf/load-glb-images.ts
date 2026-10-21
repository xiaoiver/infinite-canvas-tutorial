import { DOMAdapter } from '../../environment';
import type { GlbImageData, GlbMeshSource } from './export-glb';

function imageMime(bytes: Uint8Array): GlbImageData['mimeType'] | null {
  if (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)
  )
    return 'image/png';
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return 'image/jpeg';
  return null;
}

async function rasterizeImage(blob: Blob): Promise<GlbImageData> {
  let bitmap: ImageBitmap | HTMLImageElement;
  if (
    /^image\/svg\+xml(?:;|$)/i.test(blob.type) &&
    typeof Image !== 'undefined'
  ) {
    const url = URL.createObjectURL(blob);
    try {
      bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('SVG texture decode failed'));
        image.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  } else {
    bitmap = (await DOMAdapter.get().createImage(blob)) as ImageBitmap;
  }
  try {
    if (!bitmap.width || !bitmap.height)
      throw new Error('Cannot export an empty 3D texture');
    const canvas = DOMAdapter.get().createCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!context)
      throw new Error('A 2D canvas is required to export this texture');
    context.drawImage(bitmap, 0, 0);
    const png =
      'convertToBlob' in canvas
        ? await canvas.convertToBlob({ type: 'image/png' })
        : await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob(
              (result) =>
                result
                  ? resolve(result)
                  : reject(new Error('PNG encoding failed')),
              'image/png',
            ),
          );
    return {
      bytes: new Uint8Array(await png.arrayBuffer()),
      mimeType: 'image/png',
    };
  } finally {
    if ('close' in bitmap) bitmap.close();
  }
}

async function loadImage(url: string): Promise<GlbImageData> {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok)
    throw new Error(`Cannot export 3D texture ${url}: HTTP ${response.status}`);
  const blob = await response.blob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const mimeType = imageMime(bytes);
  if (mimeType) return { bytes, mimeType };
  return rasterizeImage(blob);
}

/** Fetch each referenced image once and convert non-glTF image formats to PNG. */
export async function loadGlbImages(
  sources: readonly GlbMeshSource[],
): Promise<Map<string, GlbImageData>> {
  const urls = [
    ...new Set(
      sources.flatMap(({ mesh, material }) => {
        const hasUvs = (coord: number | undefined) =>
          !!((coord ?? 0) === 1 ? mesh.uvs1 : mesh.uvs);
        return [
          ...(material.map && hasUvs(material.mapTexCoord)
            ? [material.map]
            : []),
          ...(material.metallicRoughnessMap &&
          hasUvs(material.metallicRoughnessTexCoord)
            ? [material.metallicRoughnessMap]
            : []),
          ...(material.emissiveMap && hasUvs(material.emissiveTexCoord)
            ? [material.emissiveMap]
            : []),
          ...(material.normalMap && hasUvs(material.normalTexCoord)
            ? [material.normalMap]
            : []),
          ...(material.occlusionMap && hasUvs(material.occlusionTexCoord)
            ? [material.occlusionMap]
            : []),
        ];
      }),
    ),
  ];
  const images = await Promise.all(
    urls.map(async (url) => [url, await loadImage(url)] as const),
  );
  return new Map(images);
}
