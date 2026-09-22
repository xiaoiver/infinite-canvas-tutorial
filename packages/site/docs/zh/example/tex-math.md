---
title: "在画布上渲染 TeX 公式"
description: "将 LaTeX 渲染为贴图或路径，服务理工类白板。"
---
<!-- example-intro:zh -->

# 在画布上渲染 TeX 公式

理工场景常需要 **TeX**。栅格化最简单；提取路径在放大时更锐利但实现更重。

可按公式字符串缓存结果以保持交互流畅。

## 交互示例

<script setup>
import TeXMath from '../../components/TeXMath.vue'
</script>

<TeXMath />
