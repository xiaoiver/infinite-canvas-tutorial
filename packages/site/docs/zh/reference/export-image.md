---
outline: deep
---
触发导出行为，详见：[课程 10 - 导入和导出图片]和[课程 39 - 3D]

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

-   `format` 导出格式，支持 SVG / PNG / JPEG / WebM / GIF / GLB
-   `download` 是否触发浏览器下载行为。默认为 `true`
-   `nodes` 选择导出的图形列表，默认为 `[]` 表示导出整张画布内容

GLB 会导出已就绪的 Path 和 Rect 挤出网格。设置 `download: false` 时，
`api.export` 会立即返回 `Uint8Array`。选中分组会包含其中的挤出子图形；
空选区会导出全部已就绪的挤出网格。其他格式通过异步截图或动画导出系统处理。

由于导出图片是一个异步行为，在 System 中可以捕获导出结果，在 `Screenshot` 组件中可以获取以下属性：

-   `dataURL` base64 编码的非矢量图 [toDataURL]，格式为 PNG / JPEG
-   `svg` 矢量图字符串
-   `download` 触发导出时的对应参数
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

[课程 10 - 导入和导出图片]: /zh/guide/lesson-010
[课程 39 - 3D]: /zh/guide/lesson-039
[toDataURL]: https://developer.mozilla.org/zh-CN/docs/Web/API/HTMLCanvasElement/toDataURL
