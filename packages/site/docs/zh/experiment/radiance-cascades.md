---
layout: 'doc'
aside: false
---

<script setup>
import RadianceCascades from '../../components/RadianceCascades.vue'
</script>

用全局光照点亮你的 mermaid 流程图吧！

-   2D Radiance cascades 的实现参考了 [bevy_radiance_cascades]
-   使用 vello 渲染，所以你需要一个支持 WebGPU 的浏览器
-   使用 mermaid-to-excalidraw 解析流程图语法

更多细节详见：[课程 37 - 基于 Radiance Cascades 的 GI]

<RadianceCascades />

[课程 37 - 基于 Radiance Cascades 的 GI]: /zh/guide/lesson-037
[bevy_radiance_cascades]: https://github.com/nixonyh/bevy_radiance_cascades
