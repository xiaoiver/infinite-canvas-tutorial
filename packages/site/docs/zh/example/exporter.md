---
title: "将画布导出为 PNG / SVG"
description: "把当前场景导出为位图或矢量，便于分享与印刷流程。"
---
<!-- example-intro:zh -->

# 将画布导出为 PNG / SVG

导出能力把编辑器接入幻灯片、文档与素材管线。本示例演示如何将场景序列化为 **图像**；与剪贴板、文件相关的交互见 [第 24 课 — 上下文菜单与剪贴板](/zh/guide/lesson-024)。

请按目标媒介核对透明度、分辨率与色彩配置是否符合预期。

## 交互示例

<script setup>
import Exporter from '../../components/Exporter.vue'
</script>

<Exporter />
