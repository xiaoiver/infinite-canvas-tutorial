---
title: "场景图嵌套：简易太阳系动画"
description: "在无限画布上用嵌套的 Group 表现太阳、地球轨道与月球轨道，演示层级变换与逐帧动画。"
---
<!-- example-intro:zh -->

# 场景图嵌套：简易太阳系动画

本示例说明 **场景图** 如何组合旋转与平移：根结点负责整体旋转，子 Group 表示轨道，圆形表示天体，对应 [第 3 课 — 场景图与变换](/zh/guide/lesson-003) 中的父子变换关系。

演示在 `<ic-canvas>` 中运行，每一帧更新各结点变换，与在无限画布上搭建更复杂图形或小游戏时的思路一致。

## 交互示例

<script setup>
import SolarSystem from '../../components/SolarSystem.vue'
</script>

<SolarSystem />
