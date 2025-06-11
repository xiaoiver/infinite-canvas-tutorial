import {
  Canvas,
  DOMAdapter,
  Screenshot,
  System,
} from '@infinite-canvas-tutorial/ecs';
import { ExtendedAPI } from '../API';
import { Event } from '../event';

const downloadedFilename = 'infinite-canvas-screenshot';

export class DownloadScreenshot extends System {
  private readonly screenshots = this.query((q) => q.added.with(Screenshot));

  constructor() {
    super();
    this.query((q) => q.using(Canvas).read);
  }

  execute(): void {
    this.screenshots.added.forEach((screenshot) => {
      const { dataURL, svg, canvas, download } = screenshot.read(Screenshot);
      if (download) {
        this.downloadImage(downloadedFilename, dataURL);
      }

      const api = canvas.read(Canvas).api as ExtendedAPI;
      api.element.dispatchEvent(
        new CustomEvent(Event.SCREENSHOT_DOWNLOADED, {
          detail: {
            dataURL,
            svg,
          },
        }),
      );
    });
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
