---
title: "套索选择"
description: "用自由轮廓圈选不规则区域。"
---
<!-- example-intro:zh -->

# 套索选择

套索需做 **路径包含** 与命中对象测试，见 [第 26 课 — 选择工具](/zh/guide/lesson-026)；对象很多时可借助空间索引。

区分点击与拖拽阈值，减少误触套索。

## 交互示例

<script setup>
import Lasso from '../../components/Lasso.vue'
</script>

<Lasso />
