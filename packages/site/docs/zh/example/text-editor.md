---
title: "简易富文本编辑表面"
description: "在画布上实现光标、选区与基础样式。"
---
<!-- example-intro:zh -->

# 简易富文本编辑表面

在画布上搭建 **编辑器** 需重做光标、选区与 IME 等逻辑，见 [第 15](/zh/guide/lesson-015)、[第 16 课](/zh/guide/lesson-016)。

可在此示例上再叠加协同或 AI 能力。

## 交互示例

<script setup>
import TextEditor from '../../components/TextEditor.vue'
</script>

双击文本进入编辑状态。

<TextEditor />
