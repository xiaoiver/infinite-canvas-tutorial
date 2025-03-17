import {
  co,
  DOMAdapter,
  RasterScreenshotRequest,
  Screenshot,
  System,
  VectorScreenshotRequest,
} from '@infinite-canvas-tutorial/ecs';
import { LitElement } from 'lit';
import { Event } from '../event';

export class DownloadScreenshotSystem extends System {
  private readonly screenshot = this.singleton.read(Screenshot);
  private readonly rasterScreenshotRequest = this.singleton.write(
    RasterScreenshotRequest,
  );
  private readonly vectorScreenshotRequest = this.singleton.write(
    VectorScreenshotRequest,
  );

  container: LitElement;

  initialize(): void {
    this.container.addEventListener(Event.SCREENSHOT_REQUESTED, (e) => {
      if (e.detail instanceof RasterScreenshotRequest) {
        Object.assign(this.rasterScreenshotRequest, e.detail);
        this.setScreenshotTrigger(this.rasterScreenshotRequest);
      } else if (e.detail instanceof VectorScreenshotRequest) {
        Object.assign(this.vectorScreenshotRequest, e.detail);
        this.setScreenshotTrigger(this.vectorScreenshotRequest);
      }
    });
  }

  execute(): void {
    if (this.screenshot.dataURL) {
      this.downloadImage('infinite-canvas-screenshot', this.screenshot.dataURL);
      this.container.dispatchEvent(
        new CustomEvent(Event.SCREENSHOT_DOWNLOADED, {
          detail: {
            dataURL: this.screenshot.dataURL,
          },
        }),
      );
    }
  }

  @co private *setScreenshotTrigger(
    screenshotRequest: RasterScreenshotRequest | VectorScreenshotRequest,
  ): Generator {
    Object.assign(screenshotRequest, { enabled: true });
    yield;
    Object.assign(screenshotRequest, { enabled: false });
  }

  private downloadImage(defaultFilename: string, dataURL: string) {
    const mimeType = dataURL.substring(
      dataURL.indexOf(':') + 1,
      dataURL.indexOf(';'),
    );
    const suffix = mimeType.split('/')[1];

    // g-svg only support .svg
    const isSVG = dataURL.startsWith('data:image/svg');
    const fileName = `${defaultFilename}.${isSVG ? 'svg' : suffix}`;

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
}

declare global {
  interface HTMLElementEventMap {
    [Event.SCREENSHOT_REQUESTED]: CustomEvent<
      RasterScreenshotRequest | VectorScreenshotRequest
    >;
    [Event.SCREENSHOT_DOWNLOADED]: CustomEvent<Screenshot>;
  }
}
