import type { Entity } from '@lastolivegames/becsy';
import { FillLayers, MaterialDirty } from '../components';
import { safeAddComponent } from '../history/ElementsChange';
import {
  drawCanvasImageWithObjectFit,
  type FillLayerImageRasterOptions,
} from './fill-layer-image-object-fit';
import {
  getFillLayerDecodedBitmap,
  setFillLayerDecodedBitmapForUrl,
} from './fill-layer-image-url-raster';
import { getEnabledFillLayers } from './fillLayers';
import { FILL_IMAGE_RASTER_MAX_EDGE } from './fillImageTextureSize';

const pendingRaster = new WeakMap<Entity, { key: string }>();
const svgIntrinsicSize = new WeakMap<
  ImageBitmap,
  { width: number; height: number }
>();

/** Invalidate pending rasters when image layers or their source are reloaded. */
export function resetFillImageSvgRerasterSchedule(entity: Entity): void {
  pendingRaster.delete(entity);
}

/**
 * 判断 fill 的 URL 是否可能为 SVG（小 intrinsic 时 ImageLoader 常得到低分辨率位图，应用插值放大仍糊）。
 */
export function isLikelySvgResourceUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  const s = url.trim();
  if (/^data:image\/svg\+xml/i.test(s)) {
    return true;
  }
  const head = s.split(/[?#]/)[0] ?? s;
  if (/\.svg$/i.test(head)) {
    return true;
  }
  try {
    const u = new URL(s, 'https://local.invalid/');
    return u.pathname.toLowerCase().endsWith('.svg');
  } catch {
    return false;
  }
}

/**
 * 用 `HTMLImageElement` 在目标像素网格上重绘 SVG，再转为 `ImageBitmap`（与放大已有小位图不同，边缘更锐利）。
 */
export async function rasterizeSvgUrlToImageBitmap(
  url: string,
  width: number,
  height: number,
  options?: FillLayerImageRasterOptions,
  preserveSourceAspect = false,
): Promise<ImageBitmap | null> {
  if (
    typeof Image === 'undefined' ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1
  ) {
    return null;
  }
  return new Promise((resolve) => {
    const img = new Image();
    if (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('//')
    ) {
      img.crossOrigin = 'anonymous';
    }
    const done = (bmp: ImageBitmap | null) => resolve(bmp);
    img.onload = () => {
      try {
        let rasterWidth = width;
        let rasterHeight = height;
        if (preserveSourceAspect) {
          if (!(img.naturalWidth > 0 && img.naturalHeight > 0)) {
            done(null);
            return;
          }
          // The initial renderer may only know a 1x1 placeholder. Use the
          // loaded SVG's intrinsic size, never that placeholder's aspect ratio.
          const scale = Math.min(
            Math.max(width / img.naturalWidth, height / img.naturalHeight),
            FILL_IMAGE_RASTER_MAX_EDGE / img.naturalWidth,
            FILL_IMAGE_RASTER_MAX_EDGE / img.naturalHeight,
          );
          rasterWidth = Math.ceil(img.naturalWidth * scale);
          rasterHeight = Math.ceil(img.naturalHeight * scale);
        }
        let canvas: HTMLCanvasElement | OffscreenCanvas;
        if (typeof document !== 'undefined') {
          const c = document.createElement('canvas');
          c.width = rasterWidth;
          c.height = rasterHeight;
          canvas = c;
        } else {
          canvas = new OffscreenCanvas(rasterWidth, rasterHeight);
        }
        const ctx = canvas.getContext('2d') as
          | CanvasRenderingContext2D
          | OffscreenCanvasRenderingContext2D
          | null;
        if (!ctx) {
          done(null);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        if ('imageSmoothingQuality' in ctx) {
          (ctx as CanvasRenderingContext2D).imageSmoothingQuality = 'high';
        }
        drawCanvasImageWithObjectFit(
          ctx,
          img,
          img.naturalWidth,
          img.naturalHeight,
          rasterWidth,
          rasterHeight,
          options,
        );
        void createImageBitmap(canvas)
          .then((b) => {
            if (preserveSourceAspect)
              svgIntrinsicSize.set(b, {
                width: img.naturalWidth,
                height: img.naturalHeight,
              });
            done(b);
          })
          .catch(() => done(null));
      } catch {
        done(null);
      }
    };
    img.onerror = () => done(null);
    img.src = url;
  });
}

/** Upgrade a small SVG source raster without baking a layer's crop into the URL cache. */
export function scheduleFillImageSvgRerasterIfNeeded(o: {
  entity: Entity;
  url: string;
  targetW: number;
  targetH: number;
  sourceW: number;
  sourceH: number;
  rasterOptions?: FillLayerImageRasterOptions;
}): void {
  const { entity, url, targetW, targetH, sourceW, sourceH, rasterOptions } = o;
  if (!isLikelySvgResourceUrl(url)) {
    return;
  }
  if (targetW <= sourceW + 0.5 && targetH <= sourceH + 0.5) {
    return;
  }
  if (
    ![targetW, targetH, sourceW, sourceH].every(
      (n) => Number.isFinite(n) && n > 0,
    ) ||
    rasterOptions?.objectFit === 'none' ||
    rasterOptions?.objectFit === 'scale-down'
  ) {
    return;
  }
  // This bitmap is shared by URL, so it must remain an uncropped source image.
  // Apply each layer's object-fit/position only when drawing its own texture.
  if (Math.max(sourceW, sourceH) >= FILL_IMAGE_RASTER_MAX_EDGE) return;
  // 含 intrinsic 尺寸：主题刷新后小图会换实例，与旧 key 解耦，避免已调度成功却不再重跑
  const key = `${url}\0${targetW}\0${targetH}\0${sourceW}\0${sourceH}`;
  if (pendingRaster.get(entity)?.key === key) {
    return;
  }
  // Identity also distinguishes reset/reload of the exact same URL and size.
  const request = { key };
  pendingRaster.set(entity, request);
  void (async () => {
    let bmp: ImageBitmap | null = null;
    try {
      bmp = await rasterizeSvgUrlToImageBitmap(
        url,
        targetW,
        targetH,
        undefined,
        true,
      );
      if (
        !bmp ||
        pendingRaster.get(entity) !== request ||
        !entity.alive ||
        !entity.has(FillLayers)
      )
        return;
      const stillHasUrl = getEnabledFillLayers(entity).some(
        (l) => l.type === 'image' && l.value === url,
      );
      if (!stillHasUrl) return;
      safeAddComponent(entity, MaterialDirty);
      const current = getFillLayerDecodedBitmap(url);
      if (
        !current ||
        current.width < bmp.width ||
        current.height < bmp.height
      ) {
        setFillLayerDecodedBitmapForUrl(url, bmp, svgIntrinsicSize.get(bmp));
        bmp = null; // Ownership passes to the decoded-source cache.
      }
    } catch {
      // The ECS world/entity or browser raster facilities may have been disposed.
    } finally {
      try {
        bmp?.close();
      } catch {
        /* Best-effort release of an obsolete raster. */
      }
      if (pendingRaster.get(entity) === request) pendingRaster.delete(entity);
    }
  })();
}
