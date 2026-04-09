---
outline: deep
description: '实现动画系统，包括声明式动画API设计、Web Animations API兼容性、生成器函数动画流程以及SVG路径动画技术。'
---

# 课程 36 - Animation

在这节课中你将学习到以下内容：

-   如何设计动画 API

## 如何设计动画 API {#api-design}

声明式动画 API 的优点：

-   易于理解和使用
-   易于调试和优化
-   易于扩展和维护

### Web Animations API {#waapi}

Motion 是完全兼容 WAAPI 的，详见：[Improvements to Web Animations API]。它直接调用浏览器原生的 `element.animate()`，享受 GPU 加速、独立渲染线程、不阻塞主线程的优势。同时用 JavaScript 轻量实现 WAAPI 缺失的能力：

-   Spring 物理动画（WAAPI 只支持贝塞尔曲线）
-   独立 transform 属性（单独动画 x, y, scale 而非组合 transform）
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

### 参考 Polyfill {#polyfill}

我们可以参考 WAAPI 的 polyfill [web-animations-js]，结合我们的 ECS 系统实现。

在数据层使用类 WAAPI 的 Keyframes 格式（可序列化）

```ts
// 类似 WAAPI 的 Keyframe 格式，但完全可 JSON 序列化
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
    fill?: 'forwards' | 'backwards' | 'both';
    easing?: string; // 全局缓动（若 keyframe 未指定）
}
```

在控制层实现类 WAAPI 的 Animation 控制器。

与真正 WAAPI polyfill 的区别：

-   不要解析 CSS 字符串。WAAPI 支持 `{ transform: 'translate(100px)' }` 这类 CSS 字符串，解析成本高。直接支持 `{ x: 100 }`（类似 Motion 的独立 transform 属性）
-   内置 `ease`, `ease-in`, `ease-out`, `linear`，以及 Motion 风格的 `spring(mass, stiffness, damping)`
-   Composite 模式。参考 WAAPI 的 `composite: 'add' | 'replace'`，支持动画叠加到基础值上（如 Entity 已有位置，动画在其上叠加偏移）
-   Timeline 支持。像 Motion 的 `timeline()` 或 WAAPI 的 GroupEffect，支持多 Entity 的 stagger 动画

## SVG 动画

### 形变效果 {#morphing}

-   [vectalign]

### 虚线偏移 {#dashline-offset}

drawio 中通过动画表示连接线的方向：

![source: https://www.drawio.com/doc/faq/connector-animate](https://www.drawio.com/assets/img/blog/connector-flow-animation.svg)

> Export your diagram to a SVG file to include the connector animation when you publish it in a web page or on a content platform that supports SVG images.

## Lottie

[lottie json schema]

## Rive

## Manim

<https://github.com/3b1b/manim>

-   [Discussion in HN]

## 动画编辑器

-   [lottielab]
-   [omnilottie]

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
[omnilottie]: https://fal.ai/models/fal-ai/omnilottie/api
[web-animations-js]: https://github.com/web-animations/web-animations-js
[lottie json schema]: https://lottiefiles.github.io/lottie-docs/schema/
