---
title: "WebGPU 渲染路径"
description: "在支持的环境下走 WebGPU 渲染路径，并与 WebGL 行为做对照。"
---
<!-- example-intro:zh -->

# WebGPU 渲染路径

用于确认在选用 **WebGPU** 抽象层时，图形与渲染循环是否表现正常，可与 [第 1 课](/zh/guide/lesson-001) 的初始化与插件体系、[第 8 课](/zh/guide/lesson-008) 的性能讨论对照阅读。

若当前浏览器不可用 WebGPU，可改用 WebGL 并对比帧耗时或画面一致性。

## 交互示例

<script setup>
import WebGPU from '../../components/WebGPU.vue'
</script>

<WebGPU />

默认使用 WebGL 2/1 渲染，通过 `renderer="webgpu"` 启用 WebGPU。

```html
<ic-canvas renderer="webgpu"></ic-canvas>
```

如果未设置 `shaderCompilerPath`，则使用默认的着色器编译器路径 `'https://unpkg.com/@antv/g-device-api@1.6.13/dist/pkg/glsl_wgsl_compiler_bg.wasm'`。

该 WASM 与此前使用的 `1.6.8` 文件逐字节相同，修改地址不会升级编译器。上游包的安全说明见[第一课](/zh/guide/lesson-001)。ECS 组件 `ic-spectrum-canvas` 已[默认使用内置编译器](/zh/reference/create-app#shader-compiler)，使用 Vite 开发时需按该文档配置。

```html
<ic-canvas
    renderer="webgpu"
    shaderCompilerPath="/your/path/to/glsl_wgsl_compiler_bg.wasm"
></ic-canvas>
```
