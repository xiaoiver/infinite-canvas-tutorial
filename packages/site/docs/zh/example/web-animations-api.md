---
title: "Web Animations API 与画布"
description: "用 WAAPI 时间线驱动属性，替代临时 rAF 逻辑。"
---
<!-- example-intro:zh -->

# Web Animations API 与画布

**Web Animations API** 可与动效库、CSS 时间函数协同，适合画布与 DOM UI **同步** 动效，亦可与 [第 36 课 — 动画](/zh/guide/lesson-036) 中的手工循环对照。

需要暂停、跳转或 playbackRate 时优先考虑 WAAPI。

## 交互示例

<script setup>
import WebAnimationsAPI from '../../components/WebAnimationsAPI.vue'
</script>

Motion 尽可能兼容了 Web Animations API 并做了很多增强，例如支持 spring 动画，详见：[Improvements to Web Animations API]

```ts
import { animate } from 'motion';

// @see https://motion.dev/docs/animate#transforms
await animate(rect, { angle: 360 }, { duration: 2 });
await animate(rect, { opacity: [0, 1] }, { duration: 1.5 });
await animate(
    rect,
    { scaleX: [1, 0], scaleY: [1, 0] },
    { duration: 1.5, repeat: Infinity, repeatType: 'reverse' },
);
```

<WebAnimationsAPI />

但和 Web Animations API 还是有一些区别，例如：

-   `duration` 和 `delay`使用秒而非毫秒
-   `iterations` -> `repeat`
-   `direction` -> `repeatType`

[Improvements to Web Animations API]: https://motion.dev/docs/improvements-to-the-web-animations-api-dx
