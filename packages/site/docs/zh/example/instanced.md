---
title: "实例化绘制：合并相似几何"
description: "用实例化把大量相似图元合并为更少次绘制调用。"
---
<!-- example-intro:zh -->

# 实例化绘制：合并相似几何

当你要绘制大量 **相似** 图形（星点、重复图标等）时，实例化能摊薄 draw call 开销，主题与 [第 8 课 — 性能优化](/zh/guide/lesson-008) 一致。

压测场景时可对比开启实例化前后的帧时间。

我们可以使用 Instanced 减少 draw call，详见：<a href="/zh/guide/lesson-008">性能优化</a>

<script setup>
import Instanced from '../../components/Instanced.vue'
</script>

<Instanced />
