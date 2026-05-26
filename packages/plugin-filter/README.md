# @infinite-canvas-tutorial/plugin-filter

CSS `filter` / GPU post-processing — **optional plugin** for infinite canvas.

## 安装与启用

`@infinite-canvas-tutorial/ecs` **不再硬依赖**本包。需要 filter 效果时：

```ts
import { App, DefaultPlugins } from '@infinite-canvas-tutorial/ecs';
import { FilterPlugin } from '@infinite-canvas-tutorial/plugin-filter';

new App().addPlugins(...DefaultPlugins, FilterPlugin).run();
```

`FilterPlugin` 会：

1. `registerFilterBackend()` — 注册 parse/format、Drawcall post chain、PostProcessingRenderer
2. 注册 `PostEffectTime` system（CRT / glitch / rain 等动画时间）

未注册时：filter 字符串会被忽略，GPU 不做 post chain（no-op stub）。

## 直接引用 API

```ts
import {
    parseEffect,
    formatFilter,
    postProcessingShaders,
} from '@infinite-canvas-tutorial/plugin-filter';
```

通过 ecs 的 re-export 也可使用（需已注册 backend）：

```ts
import { parseEffect } from '@infinite-canvas-tutorial/ecs';
```

## 包结构

| 模块                        | 说明                               |
| --------------------------- | ---------------------------------- |
| `filter.ts`                 | Effect 类型、parse/format、uniform |
| `drawcall-post-chain.ts`    | Drawcall 全屏 post chain           |
| `PostProcessingRenderer.ts` | MeshPipeline 全局后处理            |
| `shaders/post-processing/`  | 全屏 post GLSL                     |
| `shaders/rain-fx/`          | raindrop-fx GPU pipeline GLSL      |
| `utils/raindrop-sim/`       | raindrop-fx CPU 模拟               |

## ecs 侧保留

-   `Filter` 组件（序列化字段）
-   `filterEntity.ts` — 从 Entity 读取 filter 字符串
-   `solidShapeRasterForFilter.ts` — 形状栅格化
-   `utils/rain-fx/rain-fx-export-context.ts` — PNG/GIF 导出时的 rain 状态（MeshPipeline 使用）

## 与 plugin-vello 对比

|          | vello               | filter              |
| -------- | ------------------- | ------------------- |
| ecs 依赖 | 无                  | 无（peer）          |
| 启用方式 | 替换 RendererPlugin | 追加 FilterPlugin   |
| 无插件时 | 默认 WebGL 渲染     | filter 字符串 no-op |
