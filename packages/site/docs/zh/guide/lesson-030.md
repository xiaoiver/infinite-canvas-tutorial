---
outline: deep
description: ''
publish: false
---

# 课程 30 - 后处理与渲染图

本节课中我们会回顾下传统基于 Shader 后处理的图像处理手段。

## 基于后处理的效果 {#post-processing}

基于 Shader 可以实现常见的图像处理效果，例如高斯模糊、Perlin 噪音、Glitch 等，当然还有最近火热的“液态玻璃”：

![source: https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers](/figma-liquid-glass.png)

![Adjust in Photoshop Web](/adjust-ps-web.png)

更多效果详见：[Paper Shaders]。

在实现中，[Pixi.js filters] 会根据对象的包围盒计算应用区域，将对象渲染到一个临时的渲染纹理（render texture）上，然后再对该纹理应用着色器效果。

### Brightness {#brightness}

我们可以使用 [CSS filter] 语法，例如 `filter: brightness(0.4);`

[Paper Shaders]: https://shaders.paper.design/
[Pixi.js filters]: https://github.com/pixijs/filters
[CSS filter]: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/filter
