---
title: "文本基线（textBaseline）对齐"
description: "并排对比 alphabetic、middle 等基线选项的视觉效果。"
---
<!-- example-intro:zh -->

# 文本基线（textBaseline）对齐

**textBaseline** 决定纵坐标与字形相对关系，在与几何、图标混排时尤为关键；枚举释义可参考 MDN，本页用双画布对照。

与矢量几何对齐时优先显式基线，而非魔法偏移。

## 交互示例

<script setup>
import TextBaseline from '../../components/TextBaseline.vue'
import TextBaseline2 from '../../components/TextBaseline2.vue'
</script>

<TextBaseline />

[textBaseline]

<TextBaseline2 />

[textBaseline]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline
