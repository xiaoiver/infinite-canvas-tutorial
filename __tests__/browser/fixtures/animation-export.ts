import {
  encodeGifFromCanvas,
  pickWebmMimeType,
  recordWebMFromCanvas,
} from '../../../packages/ecs/src/utils/animationExportCodec';

const source = document.querySelector<HTMLCanvasElement>('#source')!;
const context = source.getContext('2d')!;
const colors = ['rgb(220,30,30)', 'rgb(30,220,30)', 'rgb(30,30,220)'];
const urls: string[] = [];
function objectUrl(blob: Blob) {
  const url = URL.createObjectURL(blob);
  urls.push(url);
  return url;
}
function render(index: number) {
  context.fillStyle = colors[index];
  context.fillRect(0, 0, source.width, source.height);
}

// Preserve the real stream/recorder. Observe resource ownership at the API boundary.
async function observeCapture<T>(run: () => Promise<T>) {
  const original = HTMLCanvasElement.prototype.captureStream;
  const captured: { canvas: HTMLCanvasElement; stream: MediaStream }[] = [];
  HTMLCanvasElement.prototype.captureStream = function (fps?: number) {
    const stream = original.call(this, fps);
    captured.push({ canvas: this, stream });
    return stream;
  };
  try {
    const result = await run();
    return {
      result,
      captures: captured.map(({ canvas, stream }) => ({
        size: [canvas.width, canvas.height],
        tracks: stream.getTracks().map((track) => track.readyState),
      })),
      sourceSize: [source.width, source.height],
    };
  } finally {
    HTMLCanvasElement.prototype.captureStream = original;
  }
}

async function playWebM(blob: Blob) {
  const video = document.querySelector<HTMLVideoElement>('#video')!;
  const pixels = document.createElement('canvas');
  pixels.width = 64;
  pixels.height = 32;
  const ctx = pixels.getContext('2d', { willReadFrequently: true })!;
  const seen = new Set<number>();
  video.src = objectUrl(blob);
  await new Promise<void>((resolve, reject) => {
    let frame = 0;
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      cancelAnimationFrame(frame);
      video.onended = video.onerror = null;
      video.pause();
      if (error) reject(error);
      else resolve();
    };
    const timeout = setTimeout(
      () => finish(new Error('WebM playback timed out')),
      10000,
    );
    video.onended = () => finish();
    video.onerror = () =>
      finish(new Error(`WebM decode failed: ${video.error?.message}`));
    const sample = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        ctx.drawImage(video, 0, 0);
        const rgb = [...ctx.getImageData(32, 16, 1, 1).data].slice(0, 3);
        const max = Math.max(...rgb);
        const min = Math.min(...rgb);
        if (max > 180 && min < 70) seen.add(rgb.indexOf(max));
      }
      frame = requestAnimationFrame(sample);
    };
    frame = requestAnimationFrame(sample);
    video.play().catch((error) => finish(error));
  });
  return {
    colors: [...seen].sort(),
    size: [video.videoWidth, video.videoHeight],
  };
}

const harness = {
  mime: pickWebmMimeType,
  async gif(recover = false) {
    let failure: string | undefined;
    if (recover) {
      try {
        await encodeGifFromCanvas(
          () => source,
          3,
          5,
          (i) => {
            if (i === 1) throw new Error('injected render failure');
            render(i);
          },
        );
      } catch (error) {
        failure = (error as Error).message;
      }
    }
    const blob = await encodeGifFromCanvas(() => source, 3, 5, render);
    const image = document.querySelector<HTMLImageElement>('#gif')!;
    image.src = objectUrl(blob);
    await image.decode();
    return {
      failure,
      type: blob.type,
      size: [image.naturalWidth, image.naturalHeight],
      bytes: blob.size,
    };
  },
  async webm(recover = false) {
    return observeCapture(async () => {
      let failure: string | undefined;
      if (recover) {
        try {
          await recordWebMFromCanvas(
            () => source,
            3,
            (i) => {
              if (i === 1) throw new Error('injected render failure');
              render(i);
            },
          );
        } catch (error) {
          failure = (error as Error).message;
        }
      }
      // Keep each color for multiple paint cycles; MediaRecorder is real-time.
      const blob = await recordWebMFromCanvas(
        () => source,
        36,
        (i) => render(Math.floor(i / 12)),
      );
      return {
        failure,
        type: blob.type,
        bytes: blob.size,
        playback: await playWebM(blob),
      };
    });
  },
  async unsupported() {
    try {
      await recordWebMFromCanvas(
        () => source,
        1,
        () => render(0),
      );
      return 'unexpected success';
    } catch (error) {
      return (error as Error).message;
    }
  },
  dispose() {
    const video = document.querySelector<HTMLVideoElement>('#video')!;
    video.pause();
    video.removeAttribute('src');
    video.load();
    document.querySelector<HTMLImageElement>('#gif')!.removeAttribute('src');
    urls.splice(0).forEach((url) => URL.revokeObjectURL(url));
  },
};
window.animationExportTest = harness;
declare global {
  interface Window {
    animationExportTest: typeof harness;
  }
}
document.querySelector('#status')!.textContent = 'Ready';
