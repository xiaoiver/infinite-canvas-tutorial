---
title: "将 SVG 导入画布"
description: "解析 SVG 并映射为画布上的路径与图形，便于复用存量素材。"
---
<!-- example-intro:zh -->

# 将 SVG 导入画布

SVG 是二维素材的通用交换格式。导入路径可把徽标与插画搬到画板上，并在可行时保留可编辑性，可与 [第 22 课 — VectorNetwork](/zh/guide/lesson-022) 对照。

正式产品中需明确处理 viewBox、变换与不支持的元素。

## 交互示例

<script setup>
import ImportSVG from '../../components/ImportSVG.vue'
</script>

<ImportSVG />
