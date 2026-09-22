/**
 * input: HTMLCanvasElement (RGB)
 * output: Float32Array for later conversion to ORT.Tensor of shape [1, 3, canvas.width, canvas.height]
 *
 * inspired by: https://onnxruntime.ai/docs/tutorials/web/classify-images-nextjs-github-template.html
 **/
export function canvasToFloat32Array(canvas: HTMLCanvasElement): {
  float32Array: Float32Array;
  shape: number[];
} {
  const imageData = canvas
    .getContext('2d')!
    .getImageData(0, 0, canvas.width, canvas.height).data;
  const shape = [1, 3, canvas.width, canvas.height];

  const [redArray, greenArray, blueArray] = [
    [] as number[],
    [] as number[],
    [] as number[],
  ];

  for (let i = 0; i < imageData.length; i += 4) {
    redArray.push(imageData[i]);
    greenArray.push(imageData[i + 1]);
    blueArray.push(imageData[i + 2]);
    // skip data[i + 3] to filter out the alpha channel
  }

  const transposedData = redArray.concat(greenArray).concat(blueArray);

  const float32Array = new Float32Array(shape[1] * shape[2] * shape[3]);
  for (let i = 0; i < transposedData.length; i++) {
    float32Array[i] = transposedData[i] / 255.0; // convert to float
  }

  return { float32Array, shape };
}

export function resizeCanvas(
  canvasOrig: HTMLCanvasElement,
  size: { w: number; h: number },
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.height = size.h;
  canvas.width = size.w;

  ctx.drawImage(
    canvasOrig,
    0,
    0,
    canvasOrig.width,
    canvasOrig.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return canvas;
}

export function image2Canvas(url: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext('2d')!.drawImage(image, 0, 0);
      resolve(canvas);
    };
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = url;
  });
}

/**
 * input: onnx Tensor [B, *, W, H] and index idx
 * output: Tensor [B, idx, W, H]
 **/
export function sliceTensor(tensor, idx) {
  const [, , width, height] = tensor.dims;
  const stride = width * height;
  const start = stride * idx,
    end = start + stride;

  return tensor.cpuData.slice(start, end);
}

/**
 * input: Float32Array representing ORT.Tensor of shape [1, 1, width, height]
 * output: HTMLCanvasElement (4 channels, RGBA)
 **/
export function float32ArrayToCanvas(
  array: Float32Array,
  width: number,
  height: number,
): HTMLCanvasElement {
  const C = 4; // 4 output channels, RGBA
  const imageData = new Uint8ClampedArray(array.length * C);

  for (let srcIdx = 0; srcIdx < array.length; srcIdx++) {
    const trgIdx = srcIdx * C;
    const maskedPx = array[srcIdx] > 0;
    imageData[trgIdx] = maskedPx ? 0x32 : 0;
    imageData[trgIdx + 1] = maskedPx ? 0xcd : 0;
    imageData[trgIdx + 2] = maskedPx ? 0x32 : 0;
    // imageData[trgIdx + 3] = maskedPx > 0 ? 150 : 0 // alpha
    imageData[trgIdx + 3] = maskedPx ? 255 : 0; // alpha
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.height = height;
  canvas.width = width;
  ctx.putImageData(new ImageData(imageData, width, height), 0, 0);

  return canvas;
}

export function sliceTensorMask(maskTensor, maskIdx) {
  const [, , width, height] = maskTensor.dims;
  const stride = width * height;
  const start = stride * maskIdx,
    end = start + stride;

  const maskData = maskTensor.cpuData.slice(start, end);

  const C = 4; // 4 channels, RGBA
  const imageData = new Uint8ClampedArray(stride * C);
  for (let srcIdx = 0; srcIdx < maskData.length; srcIdx++) {
    const trgIdx = srcIdx * C;
    const maskedPx = maskData[srcIdx] > 0;
    imageData[trgIdx] = maskedPx ? 255 : 0;
    imageData[trgIdx + 1] = 0;
    imageData[trgIdx + 2] = 0;
    imageData[trgIdx + 3] = maskedPx ? 150 : 0; // alpha
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.height = height;
  canvas.width = width;
  ctx.putImageData(new ImageData(imageData, width, height), 0, 0);

  return canvas;
}
