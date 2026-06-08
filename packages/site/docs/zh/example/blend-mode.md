---
title: '节点级 mix-blend-mode'
description: '在多层渐变背景上，用 CSS mix-blend-mode 合成渐变椭圆。'
---

<!-- example-intro:zh -->

# 节点级 mix-blend-mode

本示例复刻 [MDN mix-blend-mode](https://developer.mozilla.org/zh-CN/docs/Web/CSS/mix-blend-mode) 的三色椭圆网格：每个 150×150 的单元格包含两层渐变背景，以及三个带旋转的渐变椭圆。同一单元格内的每个椭圆节点使用与下方标签相同的 `blendMode`，并与下层内容（背景及先前绘制的椭圆）进行合成。

本网格支持的混合模式：`normal`、`multiply`、`screen`、`overlay`、`difference`、`colorBurn`、`colorDodge`、`softLight`。

## 交互示例

<script setup>
import BlendMode from '../../components/BlendMode.vue'
</script>

<BlendMode />
