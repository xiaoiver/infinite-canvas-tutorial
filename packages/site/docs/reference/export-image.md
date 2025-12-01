---
outline: deep
publish: false
---

See [Lesson 10 - Importing and exporting images] for more information.

```ts
export(format: ExportFormat, download = true, nodes: SerializedNode[] = []) {}

export enum ExportFormat {
  SVG = 'svg',
  PNG = 'png',
  JPEG = 'jpeg',
}
```

-   `format` Format of exported image, including SVG / PNG / JPEG.
-   `download` Whether to trigger the browser download action. Default is `true`.
-   `nodes` Select the list of shapes to export. The default value `[]` indicates exporting the entire canvas content.

Since exporting images is an asynchronous operation, the export result can be captured in the System. The following properties can be obtained in the `Screenshot` component:

-   `dataURL` Base64-encoded non-vector image [toDataURL], in PNG / JPEG format
-   `svg` SVG string
-   `download` Corresponding parameters when triggering export
-   `canvas` Canvas Entity

```ts
import { Screenshot, System } from '@infinite-canvas-tutorial/ecs';

export class DownloadScreenshot extends System {
    private readonly screenshots = this.query((q) => q.added.with(Screenshot));

    execute(): void {
        this.screenshots.added.forEach((screenshot) => {
            const { dataURL, svg, canvas, download } =
                screenshot.read(Screenshot);
        });
    }
}
```

[Lesson 10 - Importing and exporting images]: /guide/lesson-010
[toDataURL]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL
