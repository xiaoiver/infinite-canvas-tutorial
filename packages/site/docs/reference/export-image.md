---
outline: deep
description: 'Export the canvas to an image, including 2D content and 3D meshes. See Lessons 10 and 39.'
---

See [Lesson 10 - Importing and exporting images] and [Lesson 39 - 3D] for more information.

```ts
api.export({ format: ExportFormat.PNG, download: true, nodes: [] });

export enum ExportFormat {
    SVG = 'svg',
    PNG = 'png',
    JPEG = 'jpeg',
    WEBM = 'webm',
    GIF = 'gif',
    GLB = 'glb',
}
```

-   `format` Export format, including SVG / PNG / JPEG / WebM / GIF / GLB.
-   `download` Whether to trigger the browser download action. Default is `true`.
-   `nodes` Select the list of shapes to export. The default value `[]` indicates exporting the entire canvas content.

GLB exports ready extruded Path and Rect meshes. With `download: false`,
`api.export` returns a `Uint8Array` immediately. Selected groups include their
extruded descendants. An empty selection exports all ready extruded meshes.
Other formats use the asynchronous screenshot or animation export systems.

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
[Lesson 39 - 3D]: /guide/lesson-039
[toDataURL]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL
