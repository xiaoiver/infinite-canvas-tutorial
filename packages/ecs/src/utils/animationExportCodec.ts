import { GIFEncoder, applyPalette, quantize } from 'gifenc';

/** GIF 动图导出色数档：与 `quantize` 第二项一致。 */
export type AnimationGifQuality = 'high' | 'medium' | 'low';

const GIF_QUALITY_MAX_COLORS: Record<AnimationGifQuality, number> = {
  high: 256,
  medium: 128,
  low: 64,
};

/**
 * 将「高 / 中 / 低」质量映射为每帧调色板最大色数（2–256）。
 */
export function maxColorsForAnimationGifQuality(
  quality: AnimationGifQuality | undefined,
): number {
  if (quality == null) {
    return GIF_QUALITY_MAX_COLORS.high;
  }
  const n = GIF_QUALITY_MAX_COLORS[quality];
  return n != null ? n : GIF_QUALITY_MAX_COLORS.high;
}

/**
 * 浏览器是否支持通过 {@link MediaRecorder} 写 WebM。
 */
export function pickWebmMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') {
    return null;
  }
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return null;
}

type CanvasCaptureTrack = {
  requestFrame?: () => void;
};

/**
 * 在单任务内逐帧调用 `renderFrame`，用 `canvas.captureStream(0)` + `requestFrame` 产出 WebM。
 *
 * @param getExportCanvas 与 `MeshPipeline` 栅格导出一致：整幅读主 `swapChain` 画布，局部选区读离屏 `SetupDevice` 的 canvas。首帧 `renderFrame(0)` 后再建流。
 */
export function recordWebMFromCanvas(
  getExportCanvas: () => HTMLCanvasElement,
  frameCount: number,
  renderFrame: (frameIndex: number) => void,
): Promise<Blob> {
  const mime = pickWebmMimeType();
  if (!mime) {
    return Promise.reject(new Error('WebM encoding is not supported'));
  }
  const chunks: Blob[] = [];
  return new Promise((resolve, reject) => {
    renderFrame(0);
    const htmlCanvas = getExportCanvas();
    const stream = htmlCanvas.captureStream(0);
    const track = stream.getVideoTracks()[0] as CanvasCaptureTrack;
    const recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 8_000_000,
    });
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };
    recorder.onerror = () => reject(new Error('MediaRecorder error'));
    recorder.onstop = () => {
      const base = mime.split(';')[0] ?? 'video/webm';
      resolve(new Blob(chunks, { type: base }));
    };
    try {
      recorder.start();
    } catch (e) {
      reject(e);
      return;
    }
    track.requestFrame?.();
    for (let i = 1; i < frameCount; i++) {
      renderFrame(i);
      track.requestFrame?.();
    }
    recorder.stop();
  });
}

/**
 * 将 PNG data URL 解成 ImageData（在 2D 离屏上读像素，供 gifenc 使用）。
 */
async function imageDataFromPngDataUrl(
  dataUrl: string,
  w: number,
  h: number,
  ctx: CanvasRenderingContext2D,
): Promise<ImageData> {
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('GIF frame: failed to decode PNG data URL'));
    img.src = dataUrl;
  });
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/**
 * 逐帧读回 WebGPU 画布为 ImageData，经 gifenc 量化后写入 GIF。
 *
 * 与 `MeshPipeline` 栅格截图一致：用 `toDataURL('image/png')` 从**实际渲染目标**画布取像
 *（整幅为主 canvas，局部选区为离屏 canvas）。
 */
export async function encodeGifFromCanvas(
  getExportCanvas: () => HTMLCanvasElement,
  frameCount: number,
  fps: number,
  renderFrame: (frameIndex: number) => void,
  pngQuality = 0.92,
  maxGifColors = 256,
): Promise<Blob> {
  const colorCap = Math.max(2, Math.min(256, Math.floor(maxGifColors)));
  const delay = Math.max(1, Math.round(1000 / Math.max(1, fps)));
  let w = 0;
  let h = 0;
  let ctx: CanvasRenderingContext2D | null = null;
  const gif = GIFEncoder();
  for (let i = 0; i < frameCount; i++) {
    renderFrame(i);
    const el = getExportCanvas();
    if (i === 0) {
      w = el.width;
      h = el.height;
      if (w < 1 || h < 1) {
        return new Blob();
      }
      const scratch = document.createElement('canvas');
      scratch.width = w;
      scratch.height = h;
      ctx = scratch.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        return new Blob();
      }
    } else if (el.width !== w || el.height !== h) {
      w = el.width;
      h = el.height;
      if (w < 1 || h < 1) {
        return new Blob();
      }
      (ctx!.canvas as HTMLCanvasElement).width = w;
      (ctx!.canvas as HTMLCanvasElement).height = h;
    }
    const dataUrl = el.toDataURL('image/png', pngQuality);
    const imageData = await imageDataFromPngDataUrl(dataUrl, w, h, ctx!);
    const palette = quantize(imageData.data, colorCap);
    const index = applyPalette(imageData.data, palette);
    gif.writeFrame(index, w, h, { palette, delay });
  }
  gif.finish();
  return new Blob([new Uint8Array(gif.bytes())], { type: 'image/gif' });
}
