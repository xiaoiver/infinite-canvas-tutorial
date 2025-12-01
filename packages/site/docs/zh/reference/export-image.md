---
outline: deep
publish: false
---

触发导出图片行为，详见：[课程 10 - 导入和导出图片]

```ts
export(format: ExportFormat, download = true, nodes: SerializedNode[] = []) {}

export enum ExportFormat {
  SVG = 'svg',
  PNG = 'png',
  JPEG = 'jpeg',
}
```

-   `format` 导出图片格式，支持 SVG / PNG / JPEG
-   `download` 是否触发浏览器下载行为。默认为 `true`
-   `nodes` 选择导出的图形列表，默认为 `[]` 表示导出整张画布内容

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
[toDataURL]: https://developer.mozilla.org/zh-CN/docs/Web/API/HTMLCanvasElement/toDataURL
