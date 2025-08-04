---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
    name: An infinite canvas tutorial
    tagline: Build an infinite canvas step by step.
    image:
        src: /canvas.png
        alt: Infinite Canvas
    actions:
        - theme: brand
          text: Guide
          link: /guide/lesson-001
        - theme: alt
          text: Example
          link: /example/solar-system
        - theme: alt
          text: Reference
          link: /reference/canvas
        - theme: alt
          text: Experiment
          link: /experiment/particles

features:
    - title: High-Performance Rendering
      details: Underlying rendering using WebGL & WebGPU
    - title: Interactive
      details: Executable code blocks via <a href="https://genji-md.dev">genji</a>
    - title: Works with all frameworks
      details: UIs implemented with Web Components
    - title: Rich graphics
      details: Stickies, shapes and pen
---

<script setup>
import WebGL from './components/WebGL.vue'
import Spectrum from './components/Spectrum.vue'
</script>

After lesson 17 we use the ECS architecture and spectrum for UI:

<Spectrum />

Our product results prior to lesson 17 were as follows:

<WebGL />

This tutorial covers a basic 2D graphics rendering implementation based on WebGL / WebGPU:

-   [Lesson 2 - Draw a circle]
-   [Lesson 5 - Grid]
-   [Lesson 9 - Drawing ellipse and rectangle]
-   [Lesson 12 - Draw polyline]
-   [Lesson 13 - Drawing path and sketchy style]
-   [Lesson 15 - Text rendering]
-   [Lesson 16 - Text advanced features]

Also includes UI components implemented using Web Components technology:

-   [Lesson 7 - Web UI]
-   [Lesson 18 - Refactor with ECS]
-   [Lesson 24 - Context menu and clipboard]

And some interesting topics:

-   [Lesson 17 - Gradient and pattern]
-   [Lesson 19 - History]
-   [Lesson 22 - VectorNetwork]

[Lesson 2 - Draw a circle]: /guide/lesson-002
[Lesson 5 - Grid]: /guide/lesson-005
[Lesson 9 - Drawing ellipse and rectangle]: /guide/lesson-009
[Lesson 12 - Draw polylines]: /guide/lesson-012
[Lesson 13 - Drawing path and sketchy style]: /guide/lesson-013
[Lesson 15 - Text rendering]: /guide/lesson-015
[Lesson 16 - Text advanced features]: /guide/lesson-016
[Lesson 7 - Web UI]: /guide/lesson-007
[Lesson 18 - Refactor with ECS]: /guide/lesson-018
[Lesson 19 - History]: /guide/lesson-019
[Lesson 24 - Context menu and clipboard]: /guide/lesson-024
[Lesson 22 - VectorNetwork]: /guide/lesson-022
[Lesson 17 - Gradient and pattern]: /guide/lesson-017
