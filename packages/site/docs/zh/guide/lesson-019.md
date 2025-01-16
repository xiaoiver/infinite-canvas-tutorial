---
outline: deep
publish: false
---

# 课程 19 - Animation

在这节课中你将学习到以下内容：

-   如何设计动画 API

## 如何设计动画 API {#api-design}

声明式动画 API 的优点：

-   易于理解和使用
-   易于调试和优化
-   易于扩展和维护

### Web Animations API {#waapi}

Motion 是完全兼容 WAAPI 的，详见：[Improvements to Web Animations API]

```ts
const values = {
    x: 100,
    color: '#f00',
};
animate(values, { x: 200, color: '#00f' });
```

### Animation flow with generator functions

https://motioncanvas.io/docs/flow

## Manim

https://github.com/3b1b/manim

-   [A major breakthrough in real-time vector graphics]
-   [Art meets technology: the next step in bringing our characters to life]
-   [Canvas vs WebGL]

[Improvements to Web Animations API]: https://motion.dev/docs/improvements-to-the-web-animations-api-dx
[A major breakthrough in real-time vector graphics]: https://rive.app/renderer
[Art meets technology: the next step in bringing our characters to life]: https://blog.duolingo.com/world-character-visemes/
[Canvas vs WebGL]: https://rive.app/community/doc/canvas-vs-webgl/docanjXoQ1uT
