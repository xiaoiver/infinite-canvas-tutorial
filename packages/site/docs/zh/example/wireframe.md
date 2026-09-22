---
title: "线框叠加：辅助排查布局"
description: "绘制包围与参考线，检查对齐与间距。"
---
<!-- example-intro:zh -->

# 线框叠加：辅助排查布局

线框便于在开发阶段验证 **布局引擎**、吸附与内边距，可与 [第 33 课 — 布局引擎](/zh/guide/lesson-033) 的集成对照。

建议仅在开发构建中开启，避免干扰最终用户。

Wireframe 网格可以直观地将 Geometry 展示出来，便于 debug，详见：<a href="/zh/guide/lesson-005">绘制网格</a>

<script setup>
import Wireframe from '../../components/Wireframe.vue'
</script>

<Wireframe />
