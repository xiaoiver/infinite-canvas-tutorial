---
title: "距离场（SDF）文本"
description: "用 SDF 在多字号下保持边缘清晰。"
---
<!-- example-intro:zh -->

# 距离场（SDF）文本

有向距离场（**SDF**）在合适的滤波与 mip 设置下，可在放大缩小时减少锯齿，与 [第 15](/zh/guide/lesson-015)、[第 16 课](/zh/guide/lesson-016) 的文本管线一脉相承。

可与同一段文字的 MSDF、位图字体方案在目标 DPI 下做对比。

<a href="/zh/guide/lesson-015">绘制文本</a>

<script setup>
import SDFText from '../../components/SDFText.vue'
</script>

<SDFText />
