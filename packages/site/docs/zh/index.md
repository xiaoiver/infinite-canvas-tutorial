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
