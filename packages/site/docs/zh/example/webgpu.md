---
publish: false
---

<script setup>
import WebGPU from '../../components/WebGPU.vue'
</script>

<WebGPU />

默认使用 WebGL 2/1 渲染，通过 `renderer="webgpu"` 启用 WebGPU。

```html
<ic-canvas renderer="webgpu"></ic-canvas>
```

如果未设置 `shaderCompilerPath`，则使用默认的着色器编译器路径 `'https://unpkg.com/@antv/g-device-api@1.6.8/dist/pkg/glsl_wgsl_compiler_bg.wasm'`。

```html
<ic-canvas
    renderer="webgpu"
    shaderCompilerPath="/your/path/to/glsl_wgsl_compiler_bg.wasm"
></ic-canvas>
```
