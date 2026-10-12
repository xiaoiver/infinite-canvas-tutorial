import { GIFEncoder, applyPalette, quantize } from 'gifenc';

export type AnimationGifQuality = 'high' | 'medium' | 'low';

const GIF_QUALITY_MAX_COLORS: Record<AnimationGifQuality, number> = {
  high: 256,
  medium: 128,
  low: 64,
};

export function maxColorsForAnimationGifQuality(
  quality: AnimationGifQuality | undefined,
): number {
  return (
    GIF_QUALITY_MAX_COLORS[quality ?? 'high'] ?? GIF_QUALITY_MAX_COLORS.high
  );
}

export function pickWebmMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return (
    ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(
      (mime) => MediaRecorder.isTypeSupported(mime),
    ) ?? null
  );
}

function validateFrameCount(frameCount: number) {
  if (!Number.isInteger(frameCount) || frameCount < 1) {
    throw new Error('Animation export requires a positive integer frame count');
  }
}

/** Let the renderer present before reading pixels; abort queued recording work. */
function nextAnimationFrame(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      cancelAnimationFrame(id);
      reject(new Error('Animation export stopped'));
    };
    const id = requestAnimationFrame(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    });
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
  });
}

async function drawPngFrame(
  dataUrl: string,
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  signal?: AbortSignal,
): Promise<void> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      image.onload = image.onerror = null;
      signal?.removeEventListener('abort', abort);
      if (error) reject(error);
      else resolve();
    };
    const abort = () => finish(new Error('Animation export stopped'));
    image.onload = () => finish();
    image.onerror = () =>
      finish(new Error('Animation frame PNG decode failed'));
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener('abort', abort, { once: true });
    try {
      image.src = dataUrl;
    } catch (error) {
      image.onload = image.onerror = null;
      signal?.removeEventListener('abort', abort);
      reject(error);
    }
  });
  // Drawing outside the event handler lets exceptions reject the export.
  if (signal?.aborted) throw new Error('Animation export stopped');
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
}

/**
 * Copy renderer snapshots to a 2D capture canvas. Direct WebGPU capture can
 * record black frames. Every exit stops recording and all capture tracks.
 * MediaRecorder timestamps still follow the browser's real-time capture clock.
 */
export async function recordWebMFromCanvas(
  getExportCanvas: () => HTMLCanvasElement,
  frameCount: number,
  renderFrame: (frameIndex: number) => void,
  pngQuality = 0.92,
): Promise<Blob> {
  validateFrameCount(frameCount);
  const mime = pickWebmMimeType();
  if (!mime) throw new Error('WebM encoding is not supported');

  renderFrame(0);
  await nextAnimationFrame();
  const source = getExportCanvas();
  const { width, height } = source;
  if (width < 1 || height < 1) throw new Error('WebM: export canvas is empty');
  const scratch = document.createElement('canvas');
  let stream: MediaStream | undefined;
  try {
    scratch.width = width;
    scratch.height = height;
    const context = scratch.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('WebM: 2D context is unavailable');
    await drawPngFrame(
      source.toDataURL('image/png', pngQuality),
      context,
      width,
      height,
    );
    stream = scratch.captureStream(0);
    const track = stream.getVideoTracks()[0] as
      | CanvasCaptureMediaStreamTrack
      | undefined;
    if (!track?.requestFrame)
      throw new Error('Canvas capture track has no requestFrame()');
    const recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 8_000_000,
    });

    return await new Promise<Blob>((resolve, reject) => {
      const controller = new AbortController();
      const { signal } = controller;
      const chunks: Blob[] = [];
      let settled = false;
      let allFramesCaptured = false;
      const finish = (settle: () => void) => {
        if (settled) return;
        settled = true;
        recorder.ondataavailable = recorder.onerror = recorder.onstop = null;
        controller.abort();
        if (recorder.state !== 'inactive') {
          try {
            recorder.stop();
          } catch {
            /* Track cleanup below must still run if stop fails. */
          }
        }
        settle();
      };
      const fail = (error: unknown) => finish(() => reject(error));
      recorder.ondataavailable = (event) => {
        if (!settled && event.data?.size) chunks.push(event.data);
      };
      recorder.onerror = () => fail(new Error('MediaRecorder error'));
      recorder.onstop = () => {
        if (!allFramesCaptured) {
          fail(
            new Error('MediaRecorder stopped before all frames were captured'),
          );
        } else if (!chunks.length) {
          fail(new Error('MediaRecorder produced no data'));
        } else {
          finish(() => resolve(new Blob(chunks, { type: mime.split(';')[0] })));
        }
      };
      void (async () => {
        try {
          recorder.start(100);
          if (settled) return;
          track.requestFrame();
          for (let i = 1; i < frameCount; i++) {
            if (settled) return;
            renderFrame(i);
            await nextAnimationFrame(signal);
            const next = getExportCanvas();
            if (next.width !== width || next.height !== height) {
              throw new Error('WebM: export size changed between frames');
            }
            await drawPngFrame(
              next.toDataURL('image/png', pngQuality),
              context,
              width,
              height,
              signal,
            );
            track.requestFrame();
          }
          // A paint between these callbacks lets the last requested frame reach capture.
          await nextAnimationFrame(signal);
          await nextAnimationFrame(signal);
          allFramesCaptured = true;
          recorder.stop();
        } catch (error) {
          fail(error);
        }
      })();
    });
  } finally {
    for (const track of stream?.getTracks() ?? []) {
      try {
        track.stop();
      } catch {
        /* Release the other tracks without replacing the export error. */
      }
    }
    scratch.width = scratch.height = 0;
  }
}

/** Encode fixed-size renderer snapshots with one quantized palette per frame. */
export async function encodeGifFromCanvas(
  getExportCanvas: () => HTMLCanvasElement,
  frameCount: number,
  fps: number,
  renderFrame: (frameIndex: number) => void,
  pngQuality = 0.92,
  maxGifColors = 256,
): Promise<Blob> {
  validateFrameCount(frameCount);
  if (!Number.isFinite(fps) || !Number.isFinite(maxGifColors)) {
    throw new Error('GIF: fps and palette size must be finite');
  }
  const colorCap = Math.max(2, Math.min(256, Math.floor(maxGifColors)));
  const delay = Math.max(1, Math.round(1000 / Math.max(1, fps)));
  const gif = GIFEncoder();
  const scratch = document.createElement('canvas');
  try {
    let width = 0;
    let height = 0;
    let context: CanvasRenderingContext2D | null = null;
    for (let i = 0; i < frameCount; i++) {
      renderFrame(i);
      await nextAnimationFrame();
      const source = getExportCanvas();
      if (i === 0) {
        ({ width, height } = source);
        if (width < 1 || height < 1)
          throw new Error('GIF: export canvas is empty');
        scratch.width = width;
        scratch.height = height;
        context = scratch.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('GIF: 2D context is unavailable');
      } else if (source.width !== width || source.height !== height) {
        throw new Error('GIF: export size changed between frames');
      }
      await drawPngFrame(
        source.toDataURL('image/png', pngQuality),
        context!,
        width,
        height,
      );
      const { data } = context!.getImageData(0, 0, width, height);
      const palette = quantize(data, colorCap);
      gif.writeFrame(applyPalette(data, palette), width, height, {
        palette,
        delay,
      });
    }
    gif.finish();
    return new Blob([new Uint8Array(gif.bytes())], { type: 'image/gif' });
  } finally {
    scratch.width = scratch.height = 0;
  }
}
