// input: onnx Tensor [1, 3, W, H], output: Canvas [W, H, 4]
export function imgTensorToCanvas(imgTensor: any): HTMLCanvasElement {
  const [bs, colors, width, height] = imgTensor.dims;
  const stride = width * height;

  console.log('imgTensorToCanvas', colors, width, height, imgTensor.dims);
  const tensorData = imgTensor.cpuData;
  const C = 4; // 4 output channels, RGBA
  const imageData = new Uint8ClampedArray(width * height * C);

  let srcIdx, dstIdx;
  for (let i = 0; i < width * height; i++) {
    dstIdx = i * C;
    imageData[dstIdx] = tensorData[i];
    imageData[dstIdx + 1] = tensorData[i + stride];
    imageData[dstIdx + 2] = tensorData[i + stride * 2];
    imageData[dstIdx + 3] = 255;
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.height = height;
  canvas.width = width;
  ctx.putImageData(new ImageData(imageData, width, height), 0, 0);

  return canvas;
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

export function maskCanvasToFloat32Array(canvas: HTMLCanvasElement): {
  float32Array: Float32Array;
  shape: number[];
} {
  const imageData = canvas
    .getContext('2d')
    .getImageData(0, 0, canvas.width, canvas.height).data;
  const shape = [1, 1, canvas.width, canvas.height];

  const float32Array = new Float32Array(shape[1] * shape[2] * shape[3]);

  let f = 0,
    rgb;
  for (let i = 0; i < imageData.length; i += 4) {
    rgb = imageData[i] + imageData[i + 1] + imageData[i + 2];
    float32Array[f++] = rgb > 0 ? 1.0 : 0.0;
  }

  return { float32Array, shape };
}

export function image2Canvas(url: string): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;

  return new Promise((resolve, reject) => {
    img.onload = function () {
      const largestDim =
        img.naturalWidth > img.naturalHeight
          ? img.naturalWidth
          : img.naturalHeight;
      const box = resizeAndPadBox(
        { h: img.naturalHeight, w: img.naturalWidth },
        { h: largestDim, w: largestDim },
      )!;

      const canvas = document.createElement('canvas');
      canvas.width = largestDim;
      canvas.height = largestDim;

      canvas
        .getContext('2d')!
        .drawImage(
          img,
          0,
          0,
          img.naturalWidth,
          img.naturalHeight,
          box.x,
          box.y,
          box.w,
          box.h,
        );
      resolve(canvas);
    };
  });
}

// input: source and target {w, h}, output: {x,y,w,h} to fit source nicely into target preserving aspect
export function resizeAndPadBox(sourceDim, targetDim) {
  if (sourceDim.h == sourceDim.w) {
    return { x: 0, y: 0, w: targetDim.w, h: targetDim.h };
  } else if (sourceDim.h > sourceDim.w) {
    // portrait => resize and pad left
    const newW = (sourceDim.w / sourceDim.h) * targetDim.w;
    const padLeft = Math.floor((targetDim.w - newW) / 2);

    return { x: padLeft, y: 0, w: newW, h: targetDim.h };
  } else if (sourceDim.h < sourceDim.w) {
    // landscape => resize and pad top
    const newH = (sourceDim.h / sourceDim.w) * targetDim.h;
    const padTop = Math.floor((targetDim.h - newH) / 2);

    return { x: 0, y: padTop, w: targetDim.w, h: newH };
  }
}
