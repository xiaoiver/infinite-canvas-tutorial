---
publish: false
---

<script setup>
import PythagoreanTheorem from '../../components/PythagoreanTheorem.vue'
</script>

[The Pythagorean Theorem and Its Geometric Proof]

<PythagoreanTheorem />

[Manim] 是 3Blue1Brown 的 python 动画引擎，用于生成数学动画。

![manim](https://raw.githubusercontent.com/3b1b/manim/master/logo/cropped.png)

![3Blue1Brown's space in bilibili](/3blue1brown.png)

很多著名的例子，需要花费大量时间编写脚本：

-   [How I animate 3Blue1Brown | A Manim demo with Ben Sparks] 作者本人演示制作过程
-   [Pythagoras' Theorem | Maths made Beautiful]

已有的实践：

-   [Manim Web: Mathematical Animation Engine, for the web] 使用 Dart 移植，但完成度非常低，已停止维护
-   [Generative Manim] 有 fine-tuned 的模型，喂了一些 Manim 语料，能生成 Manim 代码，在服务端执行后生成视频。

我想做的：

-   利用 LLM 分步骤（Chain-of-Thought (CoT)）解释数学问题，生成便于可视化叙事的动画脚本
-   使用基于 WebGL / WebGPU 实现的无限画布渲染动画脚本，支持以下特性：
    -   常见 2D / 3D 图形。几何场景下常用的 Axis、Grid 等
    -   [LaTex](/zh/guide/lesson-016#tex-math-rendering) 数学公式需要
    -   [相机动画](/zh/guide/lesson-004#camera-animation) 可视化叙事需要
-   可交互编辑（自然语言界面（NLI）+ GUI）。例如使用属性面板修改图形样式，使用时间轴修改动画参数等
-   导出 Gif / Lottie / Rive / Video 等其他格式

目前的实现完成度比较低：

-   Claude 3.5 sonnet 返回 Schema 包含图形与动画描述
-   支持手绘风格的渲染引擎
-   基于 Web Animations API 的动画引擎
-   动画支持种类还比较少

[Manim]: https://github.com/3b1b/manim
[Manim Web: Mathematical Animation Engine, for the web]: https://manim-web.hugos29.dev/
[Generative Manim]: https://generative-manim.vercel.app/
[Pythagoras' Theorem | Maths made Beautiful]: https://www.youtube.com/watch?v=l4FC6mIRyNQ
[How I animate 3Blue1Brown | A Manim demo with Ben Sparks]: https://www.youtube.com/watch?v=rbu7Zu5X1zI
[The Pythagorean Theorem and Its Geometric Proof]: https://omerseyfeddinkoc.medium.com/the-pythagorean-theorem-and-its-geometric-proof-41188a7b5fac
