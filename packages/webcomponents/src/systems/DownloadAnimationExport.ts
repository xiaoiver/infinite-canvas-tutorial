import {
  AnimationExportOutput,
  Canvas,
  DOMAdapter,
  System,
  safeRemoveComponent,
} from '@infinite-canvas-tutorial/ecs';
import { ExtendedAPI } from '../API';
import { Event } from '../event';

const defaultBaseName = 'infinite-canvas-animation';

export class DownloadAnimationExport extends System {
  private readonly outputs = this.query((q) => q.added.with(AnimationExportOutput));

  constructor() {
    super();
    this.query((q) => q.using(Canvas).read.and.using(AnimationExportOutput).write);
  }

  execute(): void {
    this.outputs.added.forEach((entity) => {
      const { blob, canvas, download, fileName } = entity.read(AnimationExportOutput);
      if (download) {
        this.downloadBlob(fileName || `${defaultBaseName}.bin`, blob);
      }

      const api = canvas.read(Canvas).api as ExtendedAPI;
      api.element.dispatchEvent(
        new CustomEvent(Event.SCREENSHOT_DOWNLOADED, {
          detail: {
            animationBlob: blob,
            fileName,
          },
        }),
      );
      safeRemoveComponent(entity, AnimationExportOutput);
    });
  }

  private downloadBlob(fileName: string, blob: Blob) {
    const link: HTMLAnchorElement = DOMAdapter.get()
      .getDocument()
      .createElement('a');
    const url = window.URL.createObjectURL(blob);
    link.href = url;
    link.download = fileName;
    if (link.click) {
      link.click();
    }
    window.URL.revokeObjectURL(url);
  }
}
