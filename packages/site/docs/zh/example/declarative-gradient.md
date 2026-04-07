---
title: "声明式线性/径向渐变"
description: "用数据描述渐变，而非在代码里零散改着色器参数。"
---
<!-- example-intro:zh -->

# 声明式线性/径向渐变

声明式渐变便于对接设计变量与主题，序列化停止点即可持久化，见 [第 17 课 — 渐变与图案](/zh/guide/lesson-017)。

对品牌色域有要求时，请在 sRGB 与 display-p3 间核对色标。

## 交互示例

<script setup>
import DeclarativeGradient from '../../components/DeclarativeGradient.vue'
</script>

<DeclarativeGradient />
