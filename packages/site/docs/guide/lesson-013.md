---
outline: deep
publish: false
---

# 课程 13 - 绘制 Path & 手绘风格

如果使用 SDF 绘制，在 Fragment Shader 中需要做更多的数学运算，存在一些性能问题：

![SDF path](/sdf-line.png)

因此对于 Path 常规的方式还是三角化，无论是 2D 还是 3D：

-   [Rendering SVG Paths in WebGL]
-   [Shaping Curves with Parametric Equations]
-   [WebGL 3D Geometry - Lathe]
-   [Fun with WebGL 2.0 : 027 : Bezier Curves in 3D]
-   [p5js - bezier()]
-   [GPU-accelerated Path Rendering]

[WebGL 3D Geometry - Lathe]: https://webglfundamentals.org/webgl/lessons/webgl-3d-geometry-lathe.html
[Fun with WebGL 2.0 : 027 : Bezier Curves in 3D]: https://www.youtube.com/watch?v=s3k8Od9lZBE
[Shaping Curves with Parametric Equations]: https://mattdesl.svbtle.com/shaping-curves-with-parametric-equations
[Rendering SVG Paths in WebGL]: https://css-tricks.com/rendering-svg-paths-in-webgl/
[GPU-accelerated Path Rendering]: https://developer.download.nvidia.com/devzone/devcenter/gamegraphics/files/opengl/gpupathrender.pdf
[p5js - bezier()]: https://p5js.org/reference/p5/bezier/
