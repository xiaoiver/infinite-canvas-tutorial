---
title: "MSDF 文本渲染"
description: "多通道 SDF 在斜向笔画与小字号下往往比单通道 SDF 更稳。"
---
<!-- example-intro:zh -->

# MSDF 文本渲染

**MSDF** 可视为 SDF 的增强，可与 SDF、位图示例对照，按场景选型。

大字表建议在离线阶段预计算图集，以控制首包与加载时间。

[使用预生成的 MSDF 渲染文字](/zh/guide/lesson-015#msdf)。可以看到相比 SDF 的实现，放大后文字边缘依然锐利。

<script setup>
import MSDFText from '../../components/MSDFText.vue'
</script>

<MSDFText />
