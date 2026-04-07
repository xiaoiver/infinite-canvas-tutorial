---
title: "激光笔工具"
description: "用于演示的临时高亮，不写入文档几何。"
---
<!-- example-intro:zh -->

# 激光笔工具

激光笔 **不应** 提交图元，适合实时讲解（[第 25 课](/zh/guide/lesson-025)）。淡出时间与 GPU 开销应保持很低。

若录制导出，可提供隐藏激光的选项。

## 交互示例

<script setup>
import LaserPointer from '../../components/LaserPointer.vue'
</script>

<LaserPointer />
