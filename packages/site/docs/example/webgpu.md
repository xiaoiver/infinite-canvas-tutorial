---
publish: false
---

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
