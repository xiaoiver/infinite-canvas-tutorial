---
title: '使用 Pretext 获取排版度量'
description: '体验 ECS 文本换行、字形渲染和编辑。'
---

<!-- example-intro:zh -->

# 使用 Pretext 获取排版度量

**Pretext** 为 ECS 文本布局提供换行计算。字体度量和 SDF 字形渲染由渲染器分别处理。Pretext 不负责字形塑形（shaping）或双向文本重排；当前希伯来文、阿拉伯文仍使用已有的回退路径。

## 交互示例

<script setup>
import Pretext from '../../components/Pretext.vue'
</script>

选中文本后，可拖动角点缩放，在角点外侧拖动旋转，双击进入原位编辑。仅改变显示字号时会复用 SDF atlas。

上游布局 API 见 [Pretext]。

<Pretext />

[Pretext]: https://github.com/chenglou/pretext
