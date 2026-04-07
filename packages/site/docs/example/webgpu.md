---
title: "WebGPU renderer path"
description: "Exercise the WebGPU backend of the canvas stack and compare behavior with the WebGL path."
---
<!-- example-intro:en -->

# WebGPU renderer path

Use this page to confirm that shapes and the render loop behave correctly when the **WebGPU** HAL is selected. It complements the initialization and plugin topics in [Lesson 1](/guide/lesson-001) and the performance notes in [Lesson 8](/guide/lesson-008).

If WebGPU is unavailable in the browser, fall back to WebGL and compare frame cost or visual parity.

## Interactive demo

<script setup>
import WebGPU from '../components/WebGPU.vue'
</script>

<WebGPU />

Just use `renderer="webgpu"` to enable WebGPU.

```html
<ic-canvas renderer="webgpu"></ic-canvas>
```

If you don't set `shaderCompilerPath`, it will use the default shader compiler `'https://unpkg.com/@antv/g-device-api@1.6.8/dist/pkg/glsl_wgsl_compiler_bg.wasm'`.

```html
<ic-canvas
    renderer="webgpu"
    shaderCompilerPath="/your/path/to/glsl_wgsl_compiler_bg.wasm"
></ic-canvas>
```
