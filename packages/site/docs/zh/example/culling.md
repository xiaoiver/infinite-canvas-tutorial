---
title: "视锥裁剪以降低绘制负载"
description: "对视野外的图形跳过提交，让大规模场景保持可交互帧率。"
---
<!-- example-intro:zh -->

# 视锥裁剪以降低绘制负载

**视锥裁剪** 避免把不可能出现在屏幕上的几何体送入渲染管线。本示例随平移、缩放展示仍参与绘制的对象集合，可与 [第 8 课 — 性能优化](/zh/guide/lesson-008) 对照。

当你在画板上放置成千上万图形、需要排查 CPU/GPU 耗时时，可把此页当作参考。

剔除是一种减少 draw call 的优化手段，详见：<a href="/zh/guide/lesson-008">性能优化</a>

<script setup>
import Culling from '../../components/Culling.vue'
</script>

<Culling />
