---
outline: deep
description: '节点上的类 CSS filter 字符串、光栅后处理与三维 LUT（.cube）注册。'
---

# 滤镜

序列化类型里带有 `FilterAttributes` 的节点 — 当前为 `rect`、`ellipse`、`path`、`iconfont`，以及可在 `ref` 实例上覆盖的对应字段 — 支持 `filter` 字符串，语义上接近浏览器 [CSS `filter`][mdn-filter]。引擎把字符串解析为内部效果列表，在需要时对图形的包围盒做光栅化，再执行 GPU 后处理。

渲染管线与渲染图的整体说明见 [课程 30 - 后处理与渲染图](/zh/guide/lesson-030)。

[mdn-filter]: https://developer.mozilla.org/zh-CN/docs/Web/CSS/filter

## 节点上的 `filter` {#filter-on-nodes}

与填充、描边一样写在序列化节点上；多个函数可写在同一字符串里，以空白分隔，顺序即应用顺序。

示例：

```ts
api.updateNodes([
    {
        ...node,
        filter: 'blur(4px) brightness(-0.1)',
    },
]);
```

下文各小节未列出的函数名不会被 `parseEffect` 识别（无对应分支）。权威实现：`@infinite-canvas-tutorial/ecs` 的 `parseEffect` / `formatFilter`（`utils/filter.ts`）。

## 当前支持的 filter 函数 {#supported-filters}

每个 `###` 对应 `filter` 字符串里的**函数名**。**内部类型**指 `Effect['type']`（与函数名不同时会标明）。除另有说明外，逗号列表均按逗号分割、`trim` 后按下标取值（见 `filter.ts` 各分支）。

**`formatFilter` 回写：**仅已实现序列化的效果会写回；仅饱和度的 `adjustment` → `saturate(…)`，其余 `adjustment` 字段会被**省略**。

### `blur` {#blur}

| 字段     | 解析来源                                    | 默认 / 限制                                              |
| -------- | ------------------------------------------- | -------------------------------------------------------- |
| 内部类型 | —                                           | `blur`                                                   |
| `value`  | 对括号内整体 `parseFloat`（如 `4px` → `4`） | 非有限值在后续 GPU 路径可能被处理；建议写有限数值与 `px` |

**示例：** `blur(6px)`

### `brightness` {#brightness}

| 字段     | 解析来源                                               | 默认 / 限制                                                                                               |
| -------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| 内部类型 | —                                                      | `brightness`                                                                                              |
| `value`  | `parseFloat(params.trim())` 后经 `clampGlfxBrightness` | 钳制到 **`[-1, 1]`**，`0` 为不变；**不是** CSS `brightness()` 倍数（见 `clampGlfxBrightness` 上方注释）。 |

**示例：** `brightness(-0.15)`

### `contrast` {#contrast}

| 字段     | 解析来源                           | 默认 / 限制                                                                                 |
| -------- | ---------------------------------- | ------------------------------------------------------------------------------------------- |
| 内部类型 | —                                  | `contrast`                                                                                  |
| `value`  | `parseFloat` + `clampGlfxContrast` | 先按 brightness 同类钳制，正分支再限制 **`≤ 0.999`**，避免 shader 中 `(1 - contrast) → 0`。 |

**示例：** `contrast(0.2)`

### `saturate` {#saturate}

| 字段         | 解析来源               | 默认 / 限制                                                                                                                               |
| ------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 内部类型     | —                      | `adjustment`（与 `ADJUSTMENT_DEFAULTS` 合并）                                                                                             |
| `saturation` | `parseCssFilterScalar` | 若以 `%` 结尾则 `parseFloat / 100`，否则直接 `parseFloat`。其余通道保持默认（`gamma`、`contrast`、`brightness`、RGB、`alpha` 均为 `1`）。 |

**示例：** `saturate(1.2)` 或 `saturate(50%)` → 饱和度字段 `0.5`。

### `hue-rotate` {#hue-rotate}

| 字段         | 解析来源                                  | 默认 / 限制                                                                                                 |
| ------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 内部类型     | —                                         | `hueSaturation`                                                                                             |
| `hue`        | `degreesToGlfxHue(parseHueRotateDegrees)` | 支持 `deg` / `rad` / `turn` / `grad` 子串，否则按**度**解析；映射到 glfx 色相 **`[-1, 1]`**（±1 ≈ ±180°）。 |
| `saturation` | —                                         | 单独写 `hue-rotate` 时恒为 **`0`**（饱和度由 `saturate()` 另条 token 提供）。                               |

**示例：** `hue-rotate(90deg)`

### `drop-shadow` {#drop-shadow}

按**空白**切分；前导连续可 `parseFloat` 的片段为数值（`5px` 可解析）；其后全部拼成 **`color`**（缺省为 `black`）。

| 字段                       | 来源                                | 说明                       |
| -------------------------- | ----------------------------------- | -------------------------- |
| `x`, `y`, `blur`, `spread` | 第 1 ～ 4 个数值 token              | 缺省尾部数值视为 **`0`**   |
| `color`                    | 最后一个数值 token 之后的所有 token | 可为 `rgb(...)` 等多词颜色 |

**示例：** `drop-shadow(2px 4px 6px red)`；`drop-shadow(1px 1px 2px 3px rgba(0,0,0,.4))`

### `noise` {#noise}

| 字段     | 解析来源            | 说明     |
| -------- | ------------------- | -------- |
| 内部类型 | `noise`             |          |
| `value`  | 对整体 `parseFloat` | 单一标量 |

### `pixelate` {#pixelate}

| 字段     | 解析来源              | 说明                                                                      |
| -------- | --------------------- | ------------------------------------------------------------------------- |
| 内部类型 | `pixelate`            |                                                                           |
| `size`   | `parsePixelBlockSize` | 去掉 `px`（大小写不敏感）后 `parseFloat`；非有限或 `≤ 0` 时默认为 **`1`** |

**示例：** `pixelate(12px)`

### `dot` {#dot}

逗号分隔。缺省项用解析器内建默认并通过 `parseFloat` / `> 0.5` 处理灰度开关。

| 下标 | 属性            | 默认                                      |
| ---- | --------------- | ----------------------------------------- |
| `0`  | `scale`         | `1`                                       |
| `1`  | `angle`（弧度） | `5`                                       |
| `2`  | `grayscale`     | 缺省等价 `1` → 解析为 **`1`**（灰度半调） |

**示例：** `dot(1, 5, 1)`

### `color-halftone` {#color-halftone}

| 分支               | 参数 → 字段                                                         |
| ------------------ | ------------------------------------------------------------------- |
| **4 个及以上数值** | `(centerX, centerY, angle, size)`；`size` 必须 `> 0` 否则回落为 `4` |
| **2 个数值**       | `(size, angle)`，无中心（GPU 用上传时纹理中心）                     |
| **1 个数值**       | `(size)`，`angle` 默认 `0`                                          |

`angle` 在效果对象上为**弧度**；`size` 为点径**像素**（GPU：`scale = π / size`，对齐 glfx）。

### `halftone-dots` {#halftone-dots}

逗号分隔，下标对应 `HalftoneDotsEffect`，默认值见 `HALFTONE_DOTS_DEFAULTS`。

| 下标 | 属性             | 解析说明                                                                         |
| ---- | ---------------- | -------------------------------------------------------------------------------- |
| `0`  | `size`           | 钳制 **`0–1`**                                                                   |
| `1`  | `radius`         | **`0–2`**                                                                        |
| `2`  | `contrast`       | **`0–1`**                                                                        |
| `3`  | `grid`           | `hex` / `1` → `1`；否则数值 `> 0.5` → `1`（六方格），否则 `0`（方格）            |
| `4`  | `dotStyle`       | `classic` / `gooey` / `holes` / `soft` 或整数 **`0–3`**                          |
| `5`  | `originalColors` | `false`/`0`/`no` → `false`；`true`/`1`/`yes` → `true`；否则数值 `> 0.5` → `true` |

### `fluted-glass` {#fluted-glass}

**内部类型：** `flutedGlass`。**17** 个逗号分隔数值，均 `parseFloat`，非有限则用 `FLUTED_GLASS_DEFAULTS`：

| 下标      | 属性              | 默认   | GPU 侧（简述）                            |
| --------- | ----------------- | ------ | ----------------------------------------- |
| `0`       | `size`            | `0.5`  | **`0–1`**                                 |
| `1`       | `shadows`         | `0.6`  | **`0–1`**                                 |
| `2`       | `angle`（度）     | `45`   | **`0–180`**                               |
| `3`       | `stretch`         | `0.2`  | **`0–1`**                                 |
| `4`       | `shape`           | `1`    | 整数 **`1–5`**（`GlassGridShapes`）       |
| `5`       | `distortion`      | `0.5`  | **`0–1`**                                 |
| `6`       | `highlights`      | `0.4`  | **`0–1`**                                 |
| `7`       | `distortionShape` | `1`    | 整数 **`1–5`**（`GlassDistortionShapes`） |
| `8`       | `shift`           | `0`    | **`-1–1`**                                |
| `9`       | `blur`            | `0.15` | **`0–1`**                                 |
| `10`      | `edges`           | `0.3`  | **`0–1`**                                 |
| `11`–`14` | 四边 `margin*`    | `0`    | 各 **`0–1`**                              |
| `15`      | `grainMixer`      | `0`    | **`0–1`**                                 |
| `16`      | `grainOverlay`    | `0`    | **`0–1`**                                 |

### `tsunami` {#tsunami}

**内部类型：** `tsunami`。**11** 个数值 → `TSUNAMI_DEFAULTS`；`stripeCount` 在 GPU 路径钳 **`1–256`**；`stripeAngle` 为**度**，转弧度且 **`±180°`**；`blend`：`> 0.5` → `1` 否则 `0`；`drift` 钳 **`[-1, 1]`**。

| 下标 | 属性                | 默认   |
| ---- | ------------------- | ------ |
| `0`  | `stripeCount`       | `45`   |
| `1`  | `stripeAngle`（度） | `0`    |
| `2`  | `distortion`        | `0.32` |
| `3`  | `reflection`        | `0.17` |
| `4`  | `disturbance`       | `0.03` |
| `5`  | `contortion`        | `0.13` |
| `6`  | `blend`             | `0`    |
| `7`  | `dispersion`        | `0.22` |
| `8`  | `drift`             | `0`    |
| `9`  | `shadowIntensity`   | `0.5`  |
| `10` | `offset`            | `0`    |

### `burn` {#burn}

**内部类型：** `burn`。`0–4` 为数值；颜色与布尔：

| 下标 | 属性          | 规则                                    |
| ---- | ------------- | --------------------------------------- |
| `0`  | `burn`        | 默认 `0.5`，GPU 钳 **`0–1`**            |
| `1`  | `density`     | 默认 `1`，GPU 最小 **`0.01`**           |
| `2`  | `softness`    | 默认 `0.2`                              |
| `3`  | `dispersion`  | 默认 `0.1`                              |
| `4`  | `distortion`  | 默认 `0.3`                              |
| `5`  | `edgeColor`   | CSS 颜色；**`parts.length ≥ 7`** 时读取 |
| `6`  | `maskColor`   | CSS 颜色；**`parts.length ≥ 7`** 时读取 |
| `7`  | `invertMask`  | 若存在：`parseFloat > 0.5`              |
| `8`  | `transparent` | 若存在：`parseFloat > 0.5`              |

### `crt` {#crt}

**内部类型：** `crt`。设 `n = parts.length`，**`timeIdx = n >= 11 ? 7 : 4`**。`timeIdx` 处为 `auto`/`engine`（忽略大小写）则 `useEngineTime: true`，否则为数值 `time`。

| 下标      | 属性           | 默认（`CRT_DEFAULTS`）      |
| --------- | -------------- | --------------------------- |
| `0`       | `curvature`    | `1`                         |
| `1`       | `lineWidth`    | `1`（GPU `≥ 0`）            |
| `2`       | `lineContrast` | `0.25`                      |
| `3`       | `verticalLine` | `0`（`> 0.5` 为竖向扫描线） |
| `timeIdx` | `time` / 引擎  | `0` 或引擎时钟              |

**布局：** **5 段**时时间在索引 **`4`**；**11 段及以上**为旧 Pixi 布局，时间在索引 **`7`**。

### `vignette` {#vignette}

**内部类型：** `vignette`。两个数值；GPU 将 **`size`**、**`amount`** 钳到 **`[0, 1]`**。

| 下标 | 属性     | 默认  |
| ---- | -------- | ----- |
| `0`  | `size`   | `0.5` |
| `1`  | `amount` | `0.5` |

### `ascii` {#ascii}

**内部类型：** `ascii`。

| 下标 | 属性           | 规则                                                  |
| ---- | -------------- | ----------------------------------------------------- |
| `0`  | `size`         | `parseFloat`，GPU 限制在 **`1..min(纹理宽, 纹理高)`** |
| `1`  | `replaceColor` | 若存在：`parseFloat > 0.5`                            |
| `2+` | `color`        | 从索引 2 起逗号拼接；默认 `#ffffff`                   |

### `glitch` {#glitch}

**内部类型：** `glitch`。与 `formatFilter` 一致，逗号顺序为 **`jitter`，`rgbSplit`，`time`，`blocks`**。

| 下标 | 属性          | 规则                                                                                                      |
| ---- | ------------- | --------------------------------------------------------------------------------------------------------- |
| `0`  | `jitter`      | 缺省默认 **`0.17`**                                                                                       |
| `1`  | `rgbSplit`    | 缺省默认 **`0.24`**                                                                                       |
| `2`  | `time` / 引擎 | 若 **`parts.length < 3`** → **`useEngineTime: true`**；否则 `auto`/`engine` 为引擎时间，否则为数值 `time` |
| `3`  | `blocks`      | 仅当 **`parts.length ≥ 4`** 时读取，否则默认 **`0.2`**                                                    |

### `liquid-glass` {#liquid-glass}

**内部类型：** `liquidGlass`。**17** 个数值 → `LIQUID_GLASS_DEFAULTS`：

| 下标     | 属性               | 默认                       |
| -------- | ------------------ | -------------------------- |
| `0`      | `powerFactor`      | `4`                        |
| `1`      | `fPower`           | `3`                        |
| `2`      | `noise`            | `0.1`                      |
| `3`      | `glowWeight`       | `0.3`                      |
| `4`      | `glowBias`         | `0`                        |
| `5`      | `glowEdge0`        | `0.06`                     |
| `6`      | `glowEdge1`        | `0`                        |
| `7`–`10` | `a`, `b`, `c`, `d` | `0.7`, `2.3`, `5.2`, `6.9` |
| `11`     | `centerX`          | `0.5`                      |
| `12`     | `centerY`          | `0.5`                      |
| `13`     | `scaleX`           | `1`                        |
| `14`     | `scaleY`           | `1`                        |
| `15`     | `ellipseSizeX`     | `1`                        |
| `16`     | `ellipseSizeY`     | `1`                        |

### `liquid-metal` {#liquid-metal}

**内部类型：** `liquidMetal`。`0–7` 为数值；索引 **`7`** 的 `shape` 取整后限制 **`0–4`**。

| 下标 | 属性          | 规则                                                                                                          |
| ---- | ------------- | ------------------------------------------------------------------------------------------------------------- |
| `8`  | `useImage`    | `parts.length > 8` 时：`parseFloat(parts[8]) > 0.5`                                                           |
| `9`  | `colorBack`   | `length === 10` 或 `≥ 11` 时读字符串                                                                          |
| `10` | `colorTint`   | `length ≥ 11`                                                                                                 |
| `11` | `time` / 引擎 | `length ≥ 12`：`auto`/`engine` → `useEngineTime`；否则数值。若 `< 12` 且默认 `useEngineTime` 为真则走引擎时间 |
| `12` | `usePoisson`  | `parts.length > 12`：`parseFloat > 0.5`                                                                       |

默认：`repetition` **`2`**（GPU **`1–10`**）、`shape` **`3`**、`colorBack` **`transparent`**、`colorTint` **`#ffffff`**，默认对象里 **`useEngineTime: true`**。

### `heat-map` / `heatmap` {#heat-map}

**内部类型：** `heatmap`。**`heat-map`** 与 **`heatmap`** 同一分支。

| 下标     | 属性                                                  | 规则                                       |
| -------- | ----------------------------------------------------- | ------------------------------------------ |
| `0`–`4`  | `contour`, `angle`, `noise`, `innerGlow`, `outerGlow` | 数值 / 默认                                |
| `5`      | `useImage`                                            | `parts.length > 5`                         |
| `6`      | `usePreprocess`                                       | `parts.length > 6`                         |
| `7`      | `time` / 引擎                                         | `parts.length > 7`：`auto`/`engine` 或数值 |
| `8`      | `colorBack`                                           | `parts.length > 8`                         |
| `9`–`17` | `colors[]`                                            | 至多 **9** 个渐变色段（循环 `c < 18`）     |

默认渐变见 `HEATMAP_DEFAULTS.colors`（7 档）。

### `gem-smoke` / `gemSmoke` {#gem-smoke}

**内部类型：** `gemSmoke`。`0–6` 数值；`7` 为 `shape`，取整 **`0–4`**。

| 下标      | 属性          | 规则                              |
| --------- | ------------- | --------------------------------- |
| `8`       | `useImage`    | `parts.length > 8`                |
| `9`       | `usePoisson`  | `parts.length > 9`                |
| `10`      | `time` / 引擎 | `parts.length > 10`               |
| `11`      | `colorBack`   | `parts.length > 11`               |
| `12`      | `colorInner`  | `parts.length > 12`               |
| `13`–`18` | `colors[]`    | 至多 **6** 个颜色（`c < 13 + 6`） |

### `lut` / `LUT` {#lut-filter}

**内部类型：** `lut`。由 `parseLutFilterParams` 解析：

| 形式                 | `lutKey`                                  | `strength`                                          |
| -------------------- | ----------------------------------------- | --------------------------------------------------- |
| `lut(url("…"), 0.5)` | 引号内路径                                | 闭括号后首段逗号内容，钳 **`[0, 1]`**，缺省 **`1`** |
| `lut(name("…"), 1)`  | `name()` 内名称                           | 同上                                                |
| `lut(fuji, 1)`       | 匹配 `^[a-zA-Z_][a-zA-Z0-9_-]*$` 的标识符 | 第二段                                              |
| `lut("key", 1)`      | 首段引号内字符串                          | 第二段                                              |

注册与采样见 [三维 LUT](#lut)。

### `fxaa` {#fxaa}

**内部类型：** `fxaa`。无参即可：**`fxaa()`**；解析器不依赖括号内内容。

## 解析与格式化 {#parsing-and-formatting}

编写工具或迁移存量数据时可用：

```ts
import { parseEffect, formatFilter } from '@infinite-canvas-tutorial/ecs';

const effects = parseEffect('blur(2px) lut(fuji, 0.65)');
const again = formatFilter(effects);
```

-   `parseEffect(filter: string)` 返回类型化的 `Effect[]`（缺省或无效时为空数组）。
-   `formatFilter(effects: Effect[])` 再序列化为 filter 字符串；LUT 段在 key 不是简单标识符时会保留为 `lut(url("…"), strength)` 形式。

## 三维 LUT（`.cube`）{#lut}

`lut(…)` 段使用三维颜色立方体做调色，采样与 three.js [`LUTPass`](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/LUTPass.js) 一致（半像素内缩与 `intensity` 混合）。

**对每个 WebGPU `Device` 与逻辑名注册一次 `.cube` 文本：**

```ts
import { registerCubeLutFromText } from '@infinite-canvas-tutorial/ecs';

const text = await fetch('/luts/grade_sRGB.cube').then((r) => r.text());
registerCubeLutFromText(device, 'fuji', text);
```

节点上引用：

```ts
filter: 'lut(fuji, 1)',
```

解析器支持的 key 写法还包括：

-   命名：`lut(myKey, 0.8)` — 必须与 `registerCubeLutFromText` 的 `lutKey` 一致。
-   URL 形式：`lut(url("./grade.cube"), 1)` — key 为 `url("…")` 内的路径字符串（仍需用同一字符串作为 key 完成注册）。

可用 `listRegisteredCubeLutKeys(device)` 查看当前已注册的 key；未注册时运行时会针对每个缺失 key 在控制台输出一次性警告。

`RegisterCubeLutOptions.atlasFormat`（`'u8' | 'f16' | 'f32'`）可选，用于控制 GPU 体积纹理像素格式，便于 HDR 或宽 DOMAIN 的 cube。

## 引擎时间动画 {#engine-time}

部分滤镜（如 `crt`、`glitch`）会读取引擎时间做动画。包内导出 `filterStringUsesEngineTimeCrt`、`filterStringUsesEngineTimeGlitch`、`filterStringUsesEngineTimePost`，可在导出前判断。视频导出见 [导出图片](/zh/reference/export-image) 中的 `WEBM` / `GIF` 参数。
