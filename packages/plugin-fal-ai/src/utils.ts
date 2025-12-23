export async function imageToCanvas(
  image: HTMLImageElement | string,
): Promise<HTMLCanvasElement> {
  if (typeof image === 'string') {
    const img = new Image();
    img.src = image;
    img.crossOrigin = 'anonymous';
    return new Promise<HTMLCanvasElement>((resolve, reject) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        resolve(canvas);
      };
      img.onerror = (error) => {
        reject(error);
      };
    });
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    return Promise.resolve(canvas);
  }
}
