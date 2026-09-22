---
title: "拖拽图片到画布"
description: "从桌面或浏览器拖入位图素材。"
---
<!-- example-intro:zh -->

# 拖拽图片到画布

拖拽是向画板引入参考图最快的方式。需在 drop 事件中解析 **文件** 与 **条目**，并异步解码，见 [第 10 课 — 图片导入导出](/zh/guide/lesson-010)。

对大图粘贴做尺寸与内存防护。

## 交互示例

<script setup>
import DragNDropImage from '../../components/DragNDropImage.vue'
</script>

<DragNDropImage />
