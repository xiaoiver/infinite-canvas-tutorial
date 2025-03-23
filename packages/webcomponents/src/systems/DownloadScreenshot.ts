import {
  Canvas,
  co,
  DOMAdapter,
  PreStartUp,
  RasterScreenshotRequest,
  Screenshot,
  System,
  VectorScreenshotRequest,
} from '@infinite-canvas-tutorial/ecs';
import { Event } from '../event';
import { Container } from '../components';

const downloadedFilename = 'infinite-canvas-screenshot';

export class DownloadScreenshotSystem extends System {
  private readonly canvases = this.query((q) =>
    q.current.and.added.with(Canvas),
  );

  constructor() {
    super();
    this.query((q) => q.using(Container, Screenshot).read);
    this.schedule((s) => s.before(PreStartUp));
  }

  execute(): void {
    this.canvases.added.forEach((canvas) => {
      const container = canvas.read(Container);

      container.element.addEventListener(Event.SCREENSHOT_REQUESTED, (e) => {
        if (e.detail instanceof RasterScreenshotRequest) {
          if (!canvas.has(RasterScreenshotRequest)) {
            canvas.add(RasterScreenshotRequest);
          }

          const rasterScreenshotRequest = canvas.write(RasterScreenshotRequest);
          Object.assign(rasterScreenshotRequest, e.detail);
          this.setScreenshotTrigger(rasterScreenshotRequest);
        } else if (e.detail instanceof VectorScreenshotRequest) {
          if (!canvas.has(VectorScreenshotRequest)) {
            canvas.add(VectorScreenshotRequest);
          }

          const vectorScreenshotRequest = canvas.write(VectorScreenshotRequest);
          Object.assign(vectorScreenshotRequest, e.detail);
          this.setScreenshotTrigger(vectorScreenshotRequest);
        }
      });
    });

    this.canvases.current.forEach((canvas) => {
      if (!canvas.has(Screenshot)) {
        return;
      }

      const { dataURL } = canvas.read(Screenshot);
      const container = canvas.read(Container);

      if (dataURL) {
        this.downloadImage(downloadedFilename, dataURL);
        container.element.dispatchEvent(
          new CustomEvent(Event.SCREENSHOT_DOWNLOADED, {
            detail: {
              dataURL,
            },
          }),
        );
      }
    });
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
