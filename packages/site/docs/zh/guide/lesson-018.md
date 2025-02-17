---
outline: deep
publish: false
---

# 课程 18 - 渐变和重复图案

在本节课中我们将介绍如何实现渐变和重复图案

## 使用 CanvasGradient 实现 {#canvas-gradient}

-   [G issue about gradient]

## 使用 Shader 实现 {#shader}

以上基于 Canvas 和 SVG 实现的渐变表现力有限，无法展示复杂的效果。一些设计工具例如 Sketch / Figma 社区中有很多基于 Mesh 的实现，例如：

-   [Mesh gradients plugin for Sketch]
-   [Mesh Gradient plugin for Figma]
-   [Photo gradient plugin for Figma]

我们参考一些开源的实现，有的是在 Vertex Shader 中，我们选择后者：

-   [meshgradient]
-   [Mesh gradient generator]
-   [react-mesh-gradient]

### Warping {#warping}

-   [Inigo Quilez's Domain Warping]
-   [Mike Bostock's Domain Warping]

[Mesh gradients plugin for Sketch]: https://www.meshgradients.com/
[Mesh Gradient plugin for Figma]: https://www.figma.com/community/plugin/958202093377483021/mesh-gradient
[Photo gradient plugin for Figma]: https://www.figma.com/community/plugin/1438020299097238961/photo-gradient
[meshgradient]: https://meshgradient.com/
[Mesh gradient generator]: https://kevingrajeda.github.io/meshGradient/
[react-mesh-gradient]: https://github.com/JohnnyLeek1/React-Mesh-Gradient
[G issue about gradient]: https://github.com/antvis/G/issues/977
[Inigo Quilez's Domain Warping]: https://iquilezles.org/articles/warp/
[Mike Bostock's Domain Warping]: https://observablehq.com/@mbostock/domain-warping
