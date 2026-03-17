---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
    name: An infinite canvas tutorial
    tagline: Build an infinite canvas step by step.
    image:
        src: /app.png
        alt: Infinite Canvas
    actions:
        - theme: brand
          text: App
          link: https://app.infinitecanvas.cc/
        - theme: alt
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
    - title: Works with all frameworks
      details: UIs implemented with Web Components
    - title: Integrating with AI
      details: Generate, decompose and vectorize image with AI via vercel ai-sdk
    - title: Interactive
      details: Executable code blocks via <a href="https://genji-md.dev">genji</a>
---

This tutorial covers a basic 2D graphics rendering implementation based on WebGL / WebGPU:

-   [Lesson 2 - Draw a circle]: Learn WebGL basics, use SDF (Signed Distance Field) to render anti-aliased circles, understand coordinate transformation and color blending in fragment shaders
-   [Lesson 5 - Grid]: Implement infinitely extending grid background, learn camera transformation matrices, handle conversion between screen and world coordinates
-   [Lesson 9 - Drawing ellipse and rectangle]: Use SDF to draw ellipses and rounded rectangles, implement stroke and fill, support multiple corner radius configurations
-   [Lesson 12 - Draw polyline]: Implement polyline rendering with butt, round, and square line caps, plus miter, round, and bevel line joins
-   [Lesson 13 - Drawing path and sketchy style]: Integrate Rough.js for sketchy rendering, support hachure, solid, dots fill styles with adjustable roughness
-   [Lesson 15 - Text rendering]: Implement text shaping using Canvas API, support text rendering, font loading, kerning, and emoji
-   [Lesson 16 - Text advanced features]: Implement word wrap, multi-line text alignment (left/center/right), max lines limit and text overflow handling
-   [Lesson 25 - Drawing mode and brush]: Draw rectangles and arrows, use pencil, brush, laser pointer and eraser tools
-   [Lesson 30 - Post-processing and render graph]: Build Render Graph system, implement Gaussian blur, shadows, glow post-processing effects, support multi-pass rendering pipeline
-   [Lesson 34 - Frame and clip]: Implement Frame container with clip mode (cropping overflow) and mask effects
-   [Lesson 35 - Tile-based rendering]: Use tile-based rendering to optimize large-scale scenes

Also includes UI components implemented using Web Components technology:

-   [Lesson 7 - Web UI]: Build Web Components using Lit framework, implement property binding, event system and Shadow DOM encapsulation
-   [Lesson 18 - Refactor with ECS]: Refactor core system using ECS (Entity-Component-System) architecture, implement data-driven design
-   [Lesson 24 - Context menu and clipboard]: Implement custom context menu, integrate Clipboard API for copy/cut/paste, support SVG and PNG export

And some interesting topics:

-   [Lesson 17 - Gradient and pattern]: Implement linear, radial and conic gradients with multi-stop support, plus pattern fills
-   [Lesson 19 - History]: Implement Command Pattern history system with undo, redo and batch transaction support
-   [Lesson 22 - VectorNetwork]: Implement Vector Network data structure, support Figma-style vector path editing including node connection, path merging and boolean operations

The most important thing:

-   [Lesson 28 - Integrating with AI]: Integrate Vercel AI SDK for intelligent drawing assistant, support natural language shape generation, image vectorization, layout suggestions and AI chat

[Lesson 2 - Draw a circle]: /guide/lesson-002
[Lesson 5 - Grid]: /guide/lesson-005
[Lesson 9 - Drawing ellipse and rectangle]: /guide/lesson-009
[Lesson 12 - Draw polyline]: /guide/lesson-012
[Lesson 13 - Drawing path and sketchy style]: /guide/lesson-013
[Lesson 15 - Text rendering]: /guide/lesson-015
[Lesson 16 - Text advanced features]: /guide/lesson-016
[Lesson 7 - Web UI]: /guide/lesson-007
[Lesson 18 - Refactor with ECS]: /guide/lesson-018
[Lesson 19 - History]: /guide/lesson-019
[Lesson 24 - Context menu and clipboard]: /guide/lesson-024
[Lesson 22 - VectorNetwork]: /guide/lesson-022
[Lesson 17 - Gradient and pattern]: /guide/lesson-017
[Lesson 25 - Drawing mode and brush]: /guide/lesson-025
[Lesson 28 - Integrating with AI]: /guide/lesson-028
[Lesson 30 - Post-processing and render graph]: /guide/lesson-030
[Lesson 34 - Frame and clip]: /guide/lesson-034
[Lesson 35 - Tile-based rendering]: /guide/lesson-035
