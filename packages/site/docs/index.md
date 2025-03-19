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
