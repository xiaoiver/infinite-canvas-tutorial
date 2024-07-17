import { Rectangle } from '@pixi/math';
import { Canvas } from './Canvas';
import { createSVGElement, serializeNode } from './utils';

export type DataURLType =
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'image/bmp';

/**
 * The created image data will have a resolution of 96dpi.
 * @see https://developer.mozilla.org/zh-CN/docs/Web/API/HTMLCanvasElement/toDataURL#%E5%8F%82%E6%95%B0
 */
export interface DataURLOptions {
  /**
   * The default type is image/png.
   */
  type: DataURLType;
  /**
   * The image quality between 0 and 1 for image/jpeg and image/webp.
   */
  encoderOptions: number;
}

export interface DownloadImageOptions {
  dataURL: string;
  name?: string;
}

export interface CanvasOptions {
  clippingRegion: Rectangle;
  beforeDrawImage: (context: CanvasRenderingContext2D) => void;
  afterDrawImage: (context: CanvasRenderingContext2D) => void;
}

export interface ImageExporterOptions {
  canvas: Canvas;
  defaultFilename?: string;
}

export class ImageExporter {
  constructor(private options: ImageExporterOptions) {}

  /**
   * return a HTMLCanvasElement which you can call `toDataURL` later
   *
   * @example
   * const canvas = await exporter.toCanvas();
   * canvas.toDataURL(); // data:
   */
  async toCanvas(options: Partial<CanvasOptions> = {}) {
    const { canvas: c } = this.options;
    const { width, height } = c.getDOM();
    const dpr = c.getDPR();

    const {
      clippingRegion = new Rectangle(0, 0, width, height),
      beforeDrawImage,
      afterDrawImage,
      ...rest
    } = options;
    const dataURL = await c.toDataURL(rest);
    const image = await this.getOrCreateImage(dataURL);

    const { x: sx, y: sy, width: sWidth, height: sHeight } = clippingRegion;

    const canvas = document.createElement('canvas');
    canvas.width = sWidth * dpr;
    canvas.height = sHeight * dpr;
    const context = canvas.getContext('2d');

    context.scale(dpr, dpr);

    if (beforeDrawImage) {
      beforeDrawImage(context);
    }

    const sourceImageMultipiler = image.width > width ? dpr : 1;
    context.drawImage(
      image,
      sx * sourceImageMultipiler,
      sy * sourceImageMultipiler,
      sWidth * sourceImageMultipiler,
      sHeight * sourceImageMultipiler,
      0,
      0,
      sWidth,
      sHeight,
    );

    if (afterDrawImage) {
      afterDrawImage(context);
    }

    return canvas;
  }

  toSVGDataURL() {
    const { canvas } = this.options;
    const { width, height } = canvas.getDOM();

    console.log(serializeNode(canvas.root));

    const $namespace = createSVGElement('svg');
    $namespace.setAttribute('width', `${width}`);
    $namespace.setAttribute('height', `${height}`);

    const svgDocType = document.implementation.createDocumentType(
      'svg',
      '-//W3C//DTD SVG 1.1//EN',
      'http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd',
    );
    const svgDoc = document.implementation.createDocument(
      'http://www.w3.org/2000/svg',
      'svg',
      svgDocType,
    );
    svgDoc.replaceChild($namespace, svgDoc.documentElement);
    return `data:image/svg+xml;charset=utf8,${encodeURIComponent(
      new XMLSerializer().serializeToString(svgDoc),
    )}`;
  }

  downloadImage(options: DownloadImageOptions) {
    // retrieve context at runtime
    const { defaultFilename } = this.options;
    const { dataURL, name = defaultFilename || 'g' } = options;
    const mimeType = dataURL.substring(
      dataURL.indexOf(':') + 1,
      dataURL.indexOf(';'),
    );
    const suffix = mimeType.split('/')[1];

    // g-svg only support .svg
    const isSVG = dataURL.startsWith('data:image/svg');
    const fileName = `${name}.${isSVG ? 'svg' : suffix}`;

    const link: HTMLAnchorElement = document.createElement('a');

    if (isSVG) {
      link.addEventListener('click', () => {
        link.download = fileName;
        link.href = dataURL;
      });
    } else if (window.Blob && window.URL) {
      const arr = dataURL.split(',');
      let mime = '';
      if (arr && arr.length > 0) {
        const match = arr[0].match(/:(.*?);/);
        // eslint-disable-next-line prefer-destructuring
        if (match && match.length >= 2) mime = match[1];
      }

      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);

      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }

      const blobObj = new Blob([u8arr], { type: mime });

      // account for IE
      // @see https://stackoverflow.com/a/41434373
      if ((navigator as any).msSaveBlob) {
        (navigator as any).msSaveBlob(blobObj, fileName);
      } else {
        link.addEventListener('click', () => {
          link.download = fileName;
          link.href = window.URL.createObjectURL(blobObj);
        });
      }
    }

    // trigger click
    if (link.click) {
      link.click();
    } else {
      const e = document.createEvent('MouseEvents');
      e.initEvent('click', false, false);
      link.dispatchEvent(e);
    }
  }

  private getOrCreateImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new window.Image();
      if (image) {
        image.onload = () => {
          resolve(image);
        };
        image.onerror = (ev) => {
          reject(ev);
        };
        image.crossOrigin = 'Anonymous';
        image.src = src;
      }
    });
  }
}
