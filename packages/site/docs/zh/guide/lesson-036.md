---
outline: deep
description: '实现动画系统，包括声明式动画API设计、Web Animations API兼容性、生成器函数动画流程以及SVG路径动画技术。'
---

<script setup>
import AnimationController from '../../components/AnimationController.vue';
import AnimationEasing from '../../components/AnimationEasing.vue';
import AnimationTransformOrigin from '../../components/AnimationTransformOrigin.vue';
import AnimationDasharray from '../../components/AnimationDasharray.vue';
import AnimationDashoffset from '../../components/AnimationDashoffset.vue';
import AnimationMorphing from '../../components/AnimationMorphing.vue';
import AnimationLottieBouncyBall from '../../components/AnimationLottieBouncyBall.vue';
import AnimationLottieBezier from '../../components/AnimationLottieBezier.vue';
import AnimationTimeline from '../../components/AnimationTimeline.vue';
</script>

# 课程 36 - Animation

在这节课中你将学习到以下内容：

-   如何设计动画 API
-   参考 Web Animation API 实现声明式 Keyframe 与控制器
-   实现路径、笔迹、形变等动画效果
-   支持 Lottie 等格式

## 如何设计动画 API {#api-design}

Motion 是完全兼容声明式动画 WAAPI 的，详见：[Improvements to Web Animations API]。它直接调用浏览器原生的 `element.animate()`，享受 GPU 加速、独立渲染线程、不阻塞主线程的优势。同时用 JavaScript 轻量实现 WAAPI 缺失的能力：

-   Spring 物理动画（WAAPI 只支持贝塞尔曲线）
-   独立 `transform` 属性（单独动画 x, y, scale 而非组合 transform）
-   可以指定缩放和旋转中心 `transformOrigin`
-   Timeline 序列控制 `sequence()`, `stagger()`

```ts
import { animate, stagger } from 'motion';

// 返回动画控制器，可暂停、播放、反向
const controls = animate(
    '.box',
    { x: [0, 100], opacity: [0, 1] }, // keyframes
    { duration: 0.5, delay: stagger(0.1), easing: 'spring(1, 100, 10, 0)' },
);

// 可序列化的控制指令
controls.pause();
controls.play();
controls.reverse();
```

其中 Keyframes 和 Options 是纯对象，可直接 JSON 化。但运行时状态：`animate()` 返回的 Animation 对象包含与 DOM 的绑定、当前播放时间、velocity 等运行时状态，无法序列化。

## 参考 WAAPI 实现 {#waapi}

我们可以参考 WAAPI 的 polyfill [web-animations-js]，结合我们的 ECS 系统实现。

在数据层使用类 WAAPI 的 Keyframes 格式（可序列化）

```ts
interface Keyframe {
    offset?: number; // 0-1，对应 WAAPI 的 offset
    [property: string]: any; // x, y, scale, fill, strokeWidth...
    easing?: string; // "ease-out", "spring(1, 100)"
}

interface AnimationOptions {
    duration: number; // ms
    delay?: number;
    iterations?: number | 'infinite';
    direction?: 'normal' | 'reverse' | 'alternate';
    fill?: 'forwards' | 'backwards' | 'both'; // This property specifies how the graph will be displayed when the animation is in a non-running state (e.g. before the animation starts, after it ends).
    easing?: string; // 全局缓动（若 keyframe 未指定）
}
```

在控制层实现类 WAAPI 的 Animation 控制器。与真正 WAAPI polyfill 的区别：

-   不要解析 CSS 字符串。WAAPI 支持 `{ transform: 'translate(100px)' }` 这类 CSS 字符串，解析成本高。直接支持 `{ x: 100 }`（类似 Motion 的独立 transform 属性）
-   内置 `ease`, `ease-in`, `ease-out`, `linear`，以及 Motion 风格的 `spring(mass, stiffness, damping)`
-   Composite 模式。参考 WAAPI 的 `composite: 'add' | 'replace'`，支持动画叠加到基础值上（如 Entity 已有位置，动画在其上叠加偏移）
-   Timeline 支持。像 Motion 的 `timeline()` 或 WAAPI 的 GroupEffect，支持多 Entity 的 stagger 动画

### 控制器 {#controller}

```ts
const animation = api.animate(
    node1,
    [
        { x: 100, fill: 'green' },
        { x: 200, fill: 'red' },
    ],
    {
        duration: 1000,
        direction: 'alternate',
        iterations: 'infinite',
        easing: 'ease-in-out',
    },
);
animation.pause();
animation.play();
animation.finish();
```

<AnimationController />

### 变量插值 {#interpolation}

像 `x/y/opacity` 这种数字很容易插值，对于 `fill/stroke` 这样的颜色值，需要先用 `d3-color` 解析出 rgba 各个分量再分别插值。

```ts
function interpolateValue(from: unknown, to: unknown, t: number) {
    if (isFiniteNumber(from) && isFiniteNumber(to)) {
        return interpolateNumber(from, to, t);
    }
    const fromColor = parseColor(from);
    const toColor = parseColor(to);
    if (fromColor && toColor) {
        return colorToRgbaString({
            r: interpolateNumber(fromColor.r, toColor.r, t),
            g: interpolateNumber(fromColor.g, toColor.g, t),
            b: interpolateNumber(fromColor.b, toColor.b, t),
            a: interpolateNumber(fromColor.a, toColor.a, t),
        });
    }
    return t < 1 ? from : to;
}
```

### 缓动函数 {#easing-function}

除了常规的缓动函数，我们还可以支持 `spring`

```ts
function evaluateEasing(easing: string, t: number) {
    const p = clamp01(t);
    const bezier = EASING_FUNCTION[easing as keyof typeof EASING_FUNCTION];
    if (bezier) {
        return clamp01(bezier(p));
    }
    if (easing.startsWith('spring(')) {
        return evaluateSpringEasing(p, easing);
    }
    return p;
}
```

<AnimationEasing />

### 变换中心 {#transform-origin}

<AnimationTransformOrigin />

## 特殊的动画效果 {#special-effects}

### 路径动画 {#path-animation}

Moving graphics along a path is a common requirement, and is accomplished in CSS via MotionPath.

```css
#motion-demo {
    animation: move 3000ms infinite alternate ease-in-out;
    offset-path: path('M20,20 C20,100 200,0 200,100');
}
@keyframes move {
    0% {
        offset-distance: 0%;
    }
    100% {
        offset-distance: 100%;
    }
}
```

### 笔迹动画 {#stroke-animation}

需要支持获取路径的长度：

```ts
const length = api.getTotalLength(path);
api.animate(
    path,
    [{ strokeDasharray: [0, length] }, { strokeDasharray: [length, 0] }],
    {
        duration: 3500,
    },
);
```

<AnimationDasharray />

### 虚线偏移 {#dashline-offset}

drawio 中通过动画表示连接线的方向：

![source: https://www.drawio.com/doc/faq/connector-animate](https://www.drawio.com/assets/img/blog/connector-flow-animation.svg)

> Export your diagram to a SVG file to include the connector animation when you publish it in a web page or on a content platform that supports SVG images.

```ts
api.animate(node, [{ strokeDashoffset: -20 }, { strokeDashoffset: 0 }], {
    duration: 500,
    iterations: Infinity,
});
```

<AnimationDashoffset />

### 形变效果 {#morphing}

在很多 SVG 相关的库中都能看到形变动画的例子，例如：

-   [Paper.js]
-   [Kute.js] 提供了 Morph 和 CubicMorph 两个组件
-   GreenSocks 提供的 MorphSVGPlugin 插件甚至能在 Canvas 中渲染
-   [vectalign]

以上部分库会要求变换前后的路径定义包含相同的分段，不然无法进行插值。

参考 Kute.js 中的 CubicMorph，首先将 Path 定义中的各个部分转成三阶贝塞尔曲线表示，然后利用三阶贝塞尔曲线易于分割的特性，将变换前后的路径规范到相同数目的分段，最后对各个分段中的控制点进行插值实现动画效果

```ts
function mergePaths(
    left: { absolutePath: AbsoluteArray; curve: CurveArray | null },
    right: { absolutePath: AbsoluteArray; curve: CurveArray | null },
): [CurveArray, CurveArray, (b: CurveArray) => CurveArray] {
    let curve1 = left.curve;
    let curve2 = right.curve;
    if (!curve1 || curve1.length === 0) {
        // convert to curves to do morphing & picking later
        // @see http://thednp.github.io/kute.js/svgCubicMorph.html
        curve1 = path2Curve(left.absolutePath, false) as CurveArray;
        left.curve = curve1;
    }
    if (!curve2 || curve2.length === 0) {
        curve2 = path2Curve(right.absolutePath, false) as CurveArray;
        right.curve = curve2;
    }

    let curves = [curve1, curve2];
    if (curve1.length !== curve2.length) {
        curves = equalizeSegments(curve1, curve2);
    }

    const curve0 =
        getDrawDirection(curves[0]) !== getDrawDirection(curves[1])
            ? reverseCurve(curves[0])
            : (clonePath(curves[0]) as CurveArray);

    return [
        curve0,
        getRotatedCurve(curves[1], curve0) as CurveArray,
        (pathArray: CurveArray) => {
            // need converting to path string?
            return pathArray;
        },
    ];
}
```

<AnimationMorphing />

## Lottie

-   [lottie json schema]
-   [Tips for rendering]
-   [lottie-parser] 我们主要参考它的解析逻辑
-   [velato] 是一个使用 vello 的渲染器

### 使用方法 {#lottie-usage}

我们实现了一个插件，将 lottie json 转换成图形和 keyframes，以下是一些实现要点：

-   支持 Shape Layer 中定义的以下元素：
    -   [Rectangle](https://lottiefiles.github.io/lottie-docs/shapes/#rectangle)
    -   [Ellipse](https://lottiefiles.github.io/lottie-docs/shapes/#ellipse)
    -   [Path](https://lottiefiles.github.io/lottie-docs/shapes/#path)
    -   [Group](https://lottiefiles.github.io/lottie-docs/shapes/#group)
-   lottie 中的 `anchorX/anchorY` 表示缩放和旋转中心，相对于图形的包围盒左上角，在映射到 `transformOrigin` 时需要注意
-   将多组动画轨道合并成一组 keyframes，补全缺失的属性

```ts
import { loadAnimation } from '@infinite-canvas-tutorial/lottie';

const response = await fetch('/bouncy_ball.json');
const animation = loadAnimation(await response.json(), {
    loop: true,
    autoplay: true,
    onDiagnostic: ({ code, path, message }) =>
        console.info(code, path, message),
});

await api.edit(() => animation.render(api), { capture: 'NEVER' });

// On component unmount (also automatically cleaned up on canvas destruction):
// await animation.destroy();
```

下面是官方示例的运行效果：[Bouncy Ball]

<AnimationLottieBouncyBall />

### 兼容性范围 {#lottie-compatibility}

这是将 Lottie 转换成 ECS 节点和关键帧的导入器，目前并非完整的 Lottie 播放器。下表描述的是实际渲染能力，不能把“解析了字段”等同于“支持了效果”。

| 特性                                                       | 当前状态                                                                                                                                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 矩形、椭圆、路径、分组；基础填充和描边                     | 支持基础静态形状、路径 morph 和 2D 位置/旋转/缩放动画；原始图形的尺寸/圆角动画仍有限制                                                                |
| Solid、Null、父子层级、Precomp                             | 基础支持；图层 in/out 可见性、时间拉伸和重映射未完整实现                                                                                              |
| 渐变、多重填充/描边                                        | 基础渐变可用；渐变几何动画、径向高光、多重绘制及运算顺序有限制                                                                                        |
| Trim Paths                                                 | 用描边虚线近似；已修正完整/空路径、端点排序和偏移。填充裁切、多路径模式、与原有虚线样式叠加、动画中的零长度圆头描边、路径方向及 modifier 顺序仍有限制 |
| 空间贝塞尔运动、Skew                                       | 未完整实现，导入时报告诊断                                                                                                                            |
| PolyStar、Repeater、Merge Paths、Round Corners 等 modifier | 尚未实现渲染                                                                                                                                          |
| Image                                                      | 部分支持；未处理资源目录和预加载                                                                                                                      |
| Text、Mask、Track Matte、Effects、Blend Mode、3D           | 尚未实现或无法可靠还原；ECS 支持某项能力不代表 Lottie 已完成映射                                                                                      |
| 表达式                                                     | 导入时烘焙；默认使用带有限形状图层环境的 lottie-web ExpressionManager，不等同于完整 AE 环境                                                           |

`inspectLottie(data)` 可在不修改 JSON、不执行表达式的情况下检查已知缺口。`animation.getDiagnostics()` 和 `onDiagnostic` 返回 `code`、`severity`（`partial` / `unsupported`）、JSON Pointer `path` 和说明。诊断不会中止导入；没有诊断也不代表完全兼容 AE。两个示例中的 **Compatibility notes** 会展示具体缺口。

播放器使用统一合成时间轴。`goTo(value, true)` 按相对于合成起点的帧定位，默认单位为秒，且保留播放/暂停状态。`stop()` 暂停并回到第 0 帧；`setSpeed()` 接受正数，`setDirection(-1)` 保留速度并从当前位置倒放。`playSegments([start, end])` 遵守两个端点，逆序端点表示倒放；`loop` 数字表示额外重复次数。底层 `getAnimations()` 返回的 ECS 控制器由播放器采样，请通过播放器控制时间。

同一实例重复 `render(api)` 不重复创建动画，不允许挂载到另一个画布；`destroy()` 可重复调用，取消时间轴并在安全编辑阶段移除导入的节点树。切换示例或卸载组件还需取消未完成的 fetch 和排队的编辑。固定帧浏览器测试使用锁定版本的 lottie-web 作为参考，覆盖位置动画及单路径描边 Trim Paths，不代表整个格式已通过一致性验证。

### 表达式 {#expression}

[Expressions] 描述了 After Effects 导出到 Bodymovin JSON 时，如何在属性上挂一段 JavaScript（属性对象上的字符串字段 `x`）。本教程里的 Lottie 插件**不会在每一帧实时执行**这些脚本，而是在 **`loadAnimation` / `parse` 时按合成时间范围把表达式烘焙成普通关键帧**，再由统一时间轴采样 ECS 关键帧。支持范围取决于有限的表达式环境，不能保证与 AE 一致。

下面是一段路径属性上的表达式示例（运行时仍表现为普通 shape 关键帧动画）：

```json
{
    "ty": "sh",
    "ks": {
        "a": 0,
        "k": {
            "i": [],
            "o": [],
            "v": []
        },
        "x": "var group = thisLayer.content(\"Quadratic Points\");\nvar num_points = 3;\nvar points = [];\nvar ip = [];\nvar op = [];\nfor ( var i = 0; i < num_points; i++ )\n{\n    var pos = group.content(\"p\" + i).position;\n    points.push(pos);\n    ip.push(pos);\n    op.push(pos);\n}\nvar $bm_rt = {\n    v: points,\n    i: ip,\n    o: op\n};\n"
    }
}
```

下面的示例来自：[Beziers in Lottie]

<AnimationLottieBezier />

### Text layer

尚未实现文本图层和文本动画器的导入。

### Clipping mask

现有解析不能可靠还原 mask 模式、反相、动画及 Track Matte。

[clipping-masks]

### Layer effects

尚未实现从 Lottie effects 到 ECS 的映射。

[Layer Effects]

## Rive

[Rive vs Lottie]

![source: https://rive.app/blog/rive-as-a-lottie-alternative](https://framerusercontent.com/images/gKzhMgEDMMUPLVkhMtTDfQdQrQ.png?width=1920&height=800)

## Manim

<https://github.com/3b1b/manim>

-   [Discussion in HN]

## 动画编辑器

参考 [lottielab]、[Jitter] 等产品，我们在 Web Components 层实现了一套轻量动画编辑器：**右侧 Animation 面板**负责编辑当前选中元素的 keyframes，**底部 Timeline 面板**展示整场景的时间轴并驱动全局播放头。两者共用同一份可序列化的 Keyframes 数据与 `AppState` 里的场景时钟。

![source: https://jitter.video/](/jitter.png)

### 整体布局 {#animation-editor-layout}

Taskbar 提供两个独立开关：

-   `SHOW_ANIMATION_PANEL` → `ic-spectrum-animation-panel`（右侧，与 Properties 面板并列）
-   `SHOW_TIMELINE_PANEL` → `ic-spectrum-timeline-panel`（底部 dock，横跨画布宽度）

典型工作流：

1. 选中单个元素，在 Animation 面板添加动画或编辑属性轨道。
2. 打开 Timeline，查看场景中所有带动画的图层及其时间范围。
3. 拖动播放头或点击播放，预览整场景在同一时刻的合成效果。
4. 在 Timeline 选中某条轨道会同步选中对应元素，右侧 Animation 面板随即展示该元素的 keyframes。

### 场景时钟与编辑模式 {#animation-scene-clock}

Timeline 不只是 UI，它驱动 **`AppState` 中的全局播放头**，与每个 `AnimationController` 解耦：

| 字段                   | 含义                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `animationEditing`     | 为 `true` 时进入**确定性 scrub 模式**：所有控制器按同一 `animationCurrentTime` 采样，而非各自 free-run |
| `animationCurrentTime` | 全局播放头位置（毫秒）                                                                                 |
| `animationPlaying`     | 是否自动推进播放头                                                                                     |
| `animationLoop`        | 到达场景末尾是否回到 0                                                                                 |

`AnimationSystem` 在 `animationEditing === true` 时走 `executeEditing`：暂停状态下把每个 entity 的控制器固定在 `animationCurrentTime`；播放状态下用 `performance.now()` 的 delta 推进播放头，并写回 `animationCurrentTime`。关闭 Timeline 或离开编辑模式后，原先被 pause 的控制器会从当前位置继续 autoplay，而不是从头重播。

打开 Timeline 时会自动 `setAnimationEditing(true)`，保证 scrub 与预览行为一致。

### Timeline 面板设计 {#animation-timeline}

<AnimationTimeline />

#### 轨道数据

Timeline 不直接读节点 JSON，而是通过 `api.getAnimatedTracks()` 聚合：

```ts
interface Track {
    id: string; // 节点 id
    name: string; // 图层名，缺省为 id
    properties: string[]; // 如 ['opacity', 'x']
    delay: number; // ms
    duration: number; // 有效动画时长（total − delay）
    totalDuration: number;
}
```

场景总时长 = 所有 track 的 `totalDuration` 最大值。条形块的 `left` / `width` 分别由 `delay * PX_PER_MS` 与 `duration * PX_PER_MS` 换算。

#### 交互

| 操作              | 行为                                                         |
| ----------------- | ------------------------------------------------------------ |
| 点击轨道标签      | `layersSelected = [track.id]`，高亮轨道，驱动 Animation 面板 |
| 拖动 lane / ruler | scrub 播放头，画布实时预览该帧                               |
| Play / Pause      | `toggleAnimationPlaying()`，在编辑模式下推进全局时钟         |
| Loop              | `setAnimationLoop()`，到场景末尾是否回绕                     |

### Animation 面板（与 Timeline 配合） {#animation-panel}

组件：`packages/webcomponents/src/spectrum/animation-panel.ts`。

-   仅**单选**元素时可编辑；多选或未选显示占位提示。
-   全局选项：`duration`、`delay`、默认 `easing`、`iterations`（Loop 开关）。
-   按**属性轨道**分组展示 keyframes：每行包含 `offset`（0–1）、属性值、`easing`、删除按钮。
-   **Add keyframe at playhead**：读取当前 `animationCurrentTime`，换算为 normalized offset，并调用 `controller.getCurrentValues()` 采样当前属性值——因此应先打开 Timeline 并 scrub 到目标时刻再插入 keyframe。
-   `fill` / `stroke` 使用 popover + `ic-spectrum-color-picker`；其余数值属性用 `sp-number-field`。
-   面板宽高可拖拽调整，尺寸持久化到 `localStorage`（与 Properties 面板相同的 handle 交互）。

所有编辑经 `setNodeAnimation` / `updateNodeAnimationKeyframe` 等 API 写入，参与 undo 历史与文档序列化。

### 与 Lottie 式编辑器的差异 {#animation-editor-vs-lottie}

当前实现刻意保持简单，与 [lottielab] 等完整 DCC 相比：

-   Timeline 以**节点**为轨道，而非 Lottie 的 layer + property 多轨展开；属性名显示在标签后缀（`Rect · opacity, x`）。
-   暂不支持在 Timeline 上直接拖动 keyframe 或条形块改 timing；timing 在 Animation 面板通过 `offset` 编辑。
-   表达式由插件在导入时有限烘焙；Text layer、Clipping mask 尚未可靠支持，也不能由该编辑器直接创作。

后续可在此基础上扩展：property 子轨、keyframe 菱形标记、条形块 edge 拖拽改 delay/duration 等。

### 外部参考

-   [lottielab]
-   [omnilottie]
-   [thorvg.viewer]
-   [Jitter]

## 扩展阅读

-   [Magic Animator]
-   [A major breakthrough in real-time vector graphics]
-   [Art meets technology: the next step in bringing our characters to life]
-   [Canvas vs WebGL]

[Improvements to Web Animations API]: https://motion.dev/docs/improvements-to-the-web-animations-api-dx
[A major breakthrough in real-time vector graphics]: https://rive.app/renderer
[Art meets technology: the next step in bringing our characters to life]: https://blog.duolingo.com/world-character-visemes/
[Canvas vs WebGL]: https://rive.app/community/doc/canvas-vs-webgl/docanjXoQ1uT
[vectalign]: https://github.com/bonnyfone/vectalign
[Magic Animator]: https://magicanimator.com/
[Discussion in HN]: https://news.ycombinator.com/item?id=44994071
[lottielab]: https://www.lottielab.com/
[Jitter]: https://jitter.video/
[omnilottie]: https://fal.ai/models/fal-ai/omnilottie/api
[web-animations-js]: https://github.com/web-animations/web-animations-js
[lottie json schema]: https://lottiefiles.github.io/lottie-docs/schema/
[Paper.js]: http://paperjs.org/
[Kute.js]: https://thednp.github.io/kute.js/
[Tips for rendering]: https://lottiefiles.github.io/lottie-docs/rendering/
[lottie-parser]: https://github.com/pissang/lottie-parser
[velato]: https://github.com/linebender/velato
[Bouncy Ball]: https://lottiefiles.github.io/lottie-docs/breakdown/bouncy_ball/
[Beziers in Lottie]: https://lottiefiles.github.io/lottie-docs/breakdown/bezier/#beziers-in-lottie
[Expressions]: https://lottiefiles.github.io/lottie-docs/expressions/
[clipping-masks]: https://lottie-animation-community.github.io/docs/specs/layers/common/#clipping-masks
[Layer Effects]: https://lottiefiles.github.io/lottie-docs/effects/#layer-effects
[thorvg.viewer]: https://github.com/thorvg/thorvg.viewer
[Rive vs Lottie]: https://rive.app/blog/rive-as-a-lottie-alternative
