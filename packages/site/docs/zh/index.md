---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
    name: 一个无限画布教程
    tagline: 一步步构建一个可用的无限画布
    image:
        src: /canvas.png
        alt: Infinite Canvas
    actions:
        - theme: brand
          text: 课程列表
          link: /zh/guide/lesson-001
        - theme: alt
          text: 示例
          link: /zh/example/solar-system
        - theme: alt
          text: 文档
          link: /zh/reference/canvas
        - theme: alt
          text: 实验
          link: /zh/experiment/particles

features:
    - title: 高性能渲染
      details: 使用 WebGL & WebGPU
    - title: 可交互
      details: 基于 <a href="https://genji-md.dev">genji</a> 实现的可交互代码块
    - title: 框架无关
      details: 基于 Web Components 实现的 UI 组件
    - title: 丰富的图形
      details: 2D 图形、便签、画笔
---

<script setup>
import WebGL from '../components/WebGL.vue'
import Spectrum from '../components/Spectrum.vue'
</script>

在课程 17 之后我们使用了 ECS 进行了重构，并使用 spectrum 编写 UI：

<Spectrum />

课程 17 之前的效果如下：

<WebGL />

这份教程包含基于 WebGL / WebGPU 的基础 2D 图形渲染实现：

-   [课程 2 - 绘制圆]
-   [课程 5 - 绘制网格]
-   [课程 9 - 绘制椭圆和矩形]
-   [课程 12 - 绘制折线]
-   [课程 13 - 绘制 Path & 手绘风格]
-   [课程 15 - 绘制文本]
-   [课程 16 - 文本的高级特性]

也包含使用 Web Components 技术实现的 UI 组件：

-   [课程 7 - Web UI]
-   [课程 18 - 使用 ECS 重构]
-   [课程 24 - 上下文菜单和剪贴板]

还有一些有趣的话题：

-   [课程 17 - 渐变和重复图案]
-   [课程 19 - 历史记录]
-   [课程 22 - VectorNetwork]

[课程 2 - 绘制圆]: /zh/guide/lesson-002
[课程 5 - 绘制网格]: /zh/guide/lesson-005
[课程 9 - 绘制椭圆和矩形]: /zh/guide/lesson-009
[课程 12 - 绘制折线]: /zh/guide/lesson-012
[课程 13 - 绘制 Path & 手绘风格]: /zh/guide/lesson-013
[课程 15 - 绘制文本]: /zh/guide/lesson-015
[课程 16 - 文本的高级特性]: /zh/guide/lesson-016
[课程 7 - Web UI]: /zh/guide/lesson-007
[课程 18 - 使用 ECS 重构]: /zh/guide/lesson-018
[课程 19 - 历史记录]: /zh/guide/lesson-019
[课程 24 - 上下文菜单和剪贴板]: /zh/guide/lesson-024
[课程 22 - VectorNetwork]: /zh/guide/lesson-022
[课程 17 - 渐变和重复图案]: /zh/guide/lesson-017
