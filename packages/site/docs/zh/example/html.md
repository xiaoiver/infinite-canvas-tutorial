---
title: "在画布中嵌入 HTML"
description: "让 DOM 子树随相机平移缩放，与画布协同。"
---
<!-- example-intro:zh -->

# 在画布中嵌入 HTML

嵌入 **HTML** 连接设计与 Web 平台，见 [第 29 课 — 嵌入 HTML](/zh/guide/lesson-029)。与画布层混用时注意层叠、焦点与无障碍。

动画变换时需控制重排频率。

## 交互示例

<script setup>
import HTML from '../../components/HTML.vue'
</script>

可以尝试从 VSCode 文件中拷贝粘贴代码块到画布中。

<HTML />
