import type { Entity } from '@lastolivegames/becsy';
import { FillImage, MaterialDirty } from '../components';
import { safeAddComponent } from '../history/ElementsChange';

const lastScheduledKey = new WeakMap<Entity, string>();

/**
 * `FillImage` 被重新加载（如主题切换后 `loadImage`）时须清除，否则会沿用旧
 * `url|targetW|targetH` 去重键而跳过 {@link scheduleFillImageSvgRerasterIfNeeded}，视觉上回到低分辨率插值。
 */
export function resetFillImageSvgRerasterSchedule(entity: Entity): void {
  lastScheduledKey.delete(entity);
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
): Promise<ImageBitmap | null> {
  if (typeof Image === 'undefined' || width < 1 || height < 1) {
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
      let canvas: HTMLCanvasElement | OffscreenCanvas;
      if (typeof document !== 'undefined') {
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        canvas = c;
      } else {
        canvas = new OffscreenCanvas(width, height);
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
      try {
        ctx.drawImage(img, 0, 0, width, height);
      } catch {
        done(null);
        return;
      }
      void createImageBitmap(canvas)
        .then((b) => done(b))
        .catch(() => done(null));
    };
    img.onerror = () => done(null);
    img.src = url;
  });
}

/**
 * 对 SVG：当前帧若仍用小 `ImageBitmap` 再插值到目标尺寸会偏糊，异步用矢量重栅格到 `targetW×targetH` 后写回
 * `FillImage.src` 并打 `MaterialDirty`；非 SVG 或已足够大时 no-op。
 */
export function scheduleFillImageSvgRerasterIfNeeded(o: {
  entity: Entity;
  url: string;
  targetW: number;
  targetH: number;
  sourceW: number;
  sourceH: number;
}): void {
  const { entity, url, targetW, targetH, sourceW, sourceH } = o;
  if (!isLikelySvgResourceUrl(url)) {
    return;
  }
  if (targetW <= sourceW + 0.5 && targetH <= sourceH + 0.5) {
    return;
  }
  // 含 intrinsic 尺寸：主题刷新后小图会换实例，与旧 key 解耦，避免已调度成功却不再重跑
  const key = `${url}\0${targetW}\0${targetH}\0${sourceW}\0${sourceH}`;
  if (lastScheduledKey.get(entity) === key) {
    return;
  }
  lastScheduledKey.set(entity, key);
  void (async () => {
    const bmp = await rasterizeSvgUrlToImageBitmap(url, targetW, targetH);
    if (!bmp) {
      if (lastScheduledKey.get(entity) === key) {
        lastScheduledKey.delete(entity);
      }
      return;
    }
    if (lastScheduledKey.get(entity) !== key) {
      bmp.close();
      return;
    }
    if (!entity.has(FillImage)) {
      bmp.close();
      lastScheduledKey.delete(entity);
      return;
    }
    const fi = entity.read(FillImage);
    if (fi.url !== url) {
      bmp.close();
      lastScheduledKey.delete(entity);
      return;
    }
    const prev = fi.src;
    if (prev && prev !== bmp && 'close' in prev && typeof (prev as ImageBitmap).close === 'function') {
      try {
        (prev as ImageBitmap).close();
      } catch {
        // ignore
      }
    }
    Object.assign(entity.write(FillImage), { src: bmp });
    safeAddComponent(entity, MaterialDirty);
    if (lastScheduledKey.get(entity) === key) {
      lastScheduledKey.delete(entity);
    }
  })();
}
