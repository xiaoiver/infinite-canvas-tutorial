import { Rectangle } from '@pixi/math';
import { Canvas } from './Canvas';
import { createSVGElement, serializeNode, toSVGElement } from './utils';
import { CheckboardStyle } from './plugins';
import { DOMAdapter } from './environment/adapter';

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
  /**
   * Whether to draw grid on the image.
   */
  grid: boolean;
}

export interface DownloadImageOptions {
  dataURL: string;
  name?: string;
}

export interface CanvasOptions {
  grid: boolean;
  clippingRegion: Rectangle;
  beforeDrawImage: (context: CanvasRenderingContext2D) => void;
  afterDrawImage: (context: CanvasRenderingContext2D) => void;
}

export interface SVGOptions {
  grid: boolean;
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

  toSVG(options: Partial<SVGOptions> = {}) {
    const { grid } = options;
    const { canvas } = this.options;
    const { width, height } = canvas.getDOM();

    const $namespace = createSVGElement('svg');
    $namespace.setAttribute('width', `${width}`);
    $namespace.setAttribute('height', `${height}`);

    if (grid) {
      if (canvas.checkboardStyle === CheckboardStyle.GRID) {
        this.drawLinesGrid($namespace);
      } else if (canvas.checkboardStyle === CheckboardStyle.DOTS) {
        this.drawDotsGrid($namespace);
      }
    }

    $namespace.appendChild(toSVGElement(serializeNode(canvas.root)));
    return $namespace;
  }

  toSVGDataURL(options: Partial<SVGOptions> = {}) {
    const $namespace = this.toSVG(options);
    const svgDocType = DOMAdapter.get()
      .getDocument()
      .implementation.createDocumentType(
        'svg',
        '-//W3C//DTD SVG 1.1//EN',
        'http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd',
      );
    const svgDoc = DOMAdapter.get()
      .getDocument()
      .implementation.createDocument(
        'http://www.w3.org/2000/svg',
        'svg',
        svgDocType,
      );
    svgDoc.replaceChild($namespace, svgDoc.documentElement);
    return `data:image/svg+xml;charset=utf8,${encodeURIComponent(
      DOMAdapter.get().getXMLSerializer().serializeToString(svgDoc),
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

    const link: HTMLAnchorElement = DOMAdapter.get()
      .getDocument()
      .createElement('a');

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
      const e = DOMAdapter.get().getDocument().createEvent('MouseEvents');
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

  private drawLinesGrid($namespace: SVGElement) {
    const $defs = createSVGElement('defs');
    $namespace.appendChild($defs);
    const $pattern = createSVGElement('pattern');
    $pattern.setAttribute('id', 'small-grid');
    $pattern.setAttribute('width', '10');
    $pattern.setAttribute('height', '10');
    $pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    const $path = createSVGElement('path');
    $path.setAttribute('d', 'M 10 0 L 0 0 0 10');
    $path.setAttribute('fill', 'none');
    $path.setAttribute('stroke', 'rgba(221,221,221,1)');
    $path.setAttribute('stroke-width', '1');
    $pattern.appendChild($path);

    const $pattern2 = createSVGElement('pattern');
    $pattern2.setAttribute('id', 'grid');
    $pattern2.setAttribute('width', '100');
    $pattern2.setAttribute('height', '100');
    $pattern2.setAttribute('patternUnits', 'userSpaceOnUse');
    const $rect = createSVGElement('rect');
    $rect.setAttribute('width', '100');
    $rect.setAttribute('height', '100');
    $rect.setAttribute('fill', 'url(#small-grid)');
    $pattern2.appendChild($rect);

    const $path2 = createSVGElement('path');
    $path2.setAttribute('d', 'M 100 0 L 0 0 0 100');
    $path2.setAttribute('fill', 'none');
    $path2.setAttribute('stroke', 'rgba(221,221,221,1)');
    $path2.setAttribute('stroke-width', '2');
    $pattern2.appendChild($path2);

    $defs.appendChild($pattern);
    $defs.appendChild($pattern2);

    const $rect2 = createSVGElement('rect');
    $rect2.setAttribute('width', '100%');
    $rect2.setAttribute('height', '100%');
    $rect2.setAttribute('fill', 'url(#grid)');
    $namespace.appendChild($rect2);
  }

  private drawDotsGrid($namespace: SVGElement) {
    const $defs = createSVGElement('defs');
    $namespace.appendChild($defs);
    const $circleTL = createSVGElement('circle');
    $circleTL.setAttribute('id', 'dot-tl');
    $circleTL.setAttribute('cx', '0');
    $circleTL.setAttribute('cy', '0');
    $circleTL.setAttribute('r', '2');
    $circleTL.setAttribute('fill', 'rgba(221,221,221,1)');

    const $circleTR = $circleTL.cloneNode() as SVGCircleElement;
    const $circleBL = $circleTL.cloneNode() as SVGCircleElement;
    const $circleBR = $circleTL.cloneNode() as SVGCircleElement;
    $circleTR.setAttribute('id', 'dot-tr');
    $circleTR.setAttribute('cx', '20');
    $circleBL.setAttribute('id', 'dot-bl');
    $circleBL.setAttribute('cy', '20');
    $circleBR.setAttribute('id', 'dot-br');
    $circleBR.setAttribute('cx', '20');
    $circleBR.setAttribute('cy', '20');

    $defs.appendChild($circleTL);
    $defs.appendChild($circleTR);
    $defs.appendChild($circleBL);
    $defs.appendChild($circleBR);

    const $pattern = createSVGElement('pattern');
    $pattern.setAttribute('id', 'dots-grid');
    $pattern.setAttribute('width', '20');
    $pattern.setAttribute('height', '20');
    $pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    const $useBL = createSVGElement('use');
    $useBL.setAttribute('xlink:href', '#dot-bl');
    const $useBR = createSVGElement('use');
    $useBR.setAttribute('xlink:href', '#dot-br');
    const $useTL = createSVGElement('use');
    $useTL.setAttribute('xlink:href', '#dot-tl');
    const $useTR = createSVGElement('use');
    $useTR.setAttribute('xlink:href', '#dot-tr');
    $pattern.appendChild($useBL);
    $pattern.appendChild($useBR);
    $pattern.appendChild($useTL);
    $pattern.appendChild($useTR);
    $defs.appendChild($pattern);

    const $rect = createSVGElement('rect');
    $rect.setAttribute('width', '100%');
    $rect.setAttribute('height', '100%');
    $rect.setAttribute('fill', 'url(#dots-grid)');
    $namespace.appendChild($rect);
  }
}
