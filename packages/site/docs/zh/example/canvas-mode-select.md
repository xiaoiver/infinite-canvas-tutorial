---
title: "切换画布交互模式"
description: "在选择、平移、绘制等模式间显式切换。"
---
<!-- example-intro:zh -->

# 切换画布交互模式

模式切换是白板体验的核心，可与 [第 14 课](/zh/guide/lesson-014) 的辅助 UI、[第 25 课 — 绘制模式与笔刷](/zh/guide/lesson-025) 对照。

会话恢复时建议持久化当前模式。

[画布模式 - 选择]

<script setup>
import SelectCanvasMode from '../../components/SelectCanvasMode.vue'
</script>

<SelectCanvasMode />

[画布模式 - 选择]: /zh/guide/lesson-014#select-mode
