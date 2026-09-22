---
title: "用空间索引加速拾取"
description: "结合 RBush 等结构，在密集场景中快速缩小候选图形。"
---
<!-- example-intro:zh -->

# 用空间索引加速拾取

当光标附近有大量包围盒重叠时，拾取需要接近 **O(log n)** 的候选筛选，再去做精确判断。本示例对应 [第 6 课 — 事件系统](/zh/guide/lesson-006) 与 [第 8 课 — 性能优化](/zh/guide/lesson-008) 中的交互与调优思路。

适合用来排查「点不中」或悬浮卡顿等问题。

我们可以使用 RBush 加速拾取，详见：<a href="/zh/guide/lesson-008">性能优化</a>

<script setup>
import Picking from '../../components/Picking.vue'
</script>

<Picking />
