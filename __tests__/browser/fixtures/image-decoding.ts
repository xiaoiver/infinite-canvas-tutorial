import { loadImageBitmapUniversal } from '../../../packages/ecs/src/utils/load-image-bitmap';

const canvas = document.querySelector<HTMLCanvasElement>('#decoded')!;
const ctx = canvas.getContext('2d')!;

async function read(source: string | Blob, xs = [16, 48]) {
  const bitmap = await loadImageBitmapUniversal(source);
  try {
    const size = [bitmap.width, bitmap.height];
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    ctx.drawImage(bitmap, 0, 0);
    return {
      size,
      pixels: xs.map((x) => [...ctx.getImageData(x, 16, 1, 1).data]),
    };
  } finally {
    bitmap.close();
  }
}

const harness = {
  read,
  async sources() {
    const blob = await fetch('/assets/decoder-colors.heic').then((r) =>
      r.blob(),
    );
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const unlabelled = new Blob([bytes], { type: 'application/octet-stream' });
    const objectUrl = URL.createObjectURL(unlabelled);
    const file = new File([bytes], 'photo.HEIF', {
      type: 'application/octet-stream',
    });
    const base64 = btoa(String.fromCharCode(...bytes));
    try {
      const results = [];
      for (const source of [
        '/assets/decoder-colors.heic?download=1',
        unlabelled,
        file,
        objectUrl,
        `data:application/octet-stream;base64,${base64}`,
      ])
        results.push(await read(source));
      // The caller still owns the input object URL after decoding.
      const inputStillAvailable = (await fetch(objectUrl)).ok;
      return { results, inputStillAvailable };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  },
  async withoutFile() {
    ctx.fillStyle = 'rgb(220, 60, 30)';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = 'rgb(25, 90, 220)';
    ctx.fillRect(32, 0, 32, 32);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((value) => resolve(value!), 'image/png'),
    );
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'File')!;
    Reflect.deleteProperty(globalThis, 'File');
    try {
      return await read(blob);
    } finally {
      Object.defineProperty(globalThis, 'File', descriptor);
    }
  },
  async fallback(failure: 'conversion' | 'bitmap') {
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    const originalCreate = globalThis.createImageBitmap;
    const decodedTypes: string[] = [];
    const encodedTypes: string[] = [];
    let failed = false;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      encodedTypes.push(type!);
      if (failure === 'conversion' && type === 'image/png' && !failed) {
        failed = true;
        callback(null);
        return;
      }
      originalToBlob.call(this, callback, type, quality);
    };
    // Inject only the PNG decoder failure; JPEG still uses the real browser.
    globalThis.createImageBitmap = ((source: Blob) => {
      decodedTypes.push(source.type);
      if (failure === 'bitmap' && source.type === 'image/png' && !failed) {
        failed = true;
        return Promise.reject(new Error('PNG decoder unavailable'));
      }
      return originalCreate(source);
    }) as typeof createImageBitmap;
    try {
      const result = await read('/assets/decoder-colors.heic');
      return { result, decodedTypes, encodedTypes, failed };
    } finally {
      HTMLCanvasElement.prototype.toBlob = originalToBlob;
      globalThis.createImageBitmap = originalCreate;
    }
  },
};
declare global {
  interface Window {
    imageDecodingTest: typeof harness;
  }
}
window.imageDecodingTest = harness;
document.querySelector('#status')!.textContent = 'Ready';
