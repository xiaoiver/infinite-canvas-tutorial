---
title: "与正文混排的表情符号"
description: "在同一文本管线中绘制彩色 emoji 与拉丁字符。"
---
<!-- example-intro:zh -->

# 与正文混排的表情符号

Emoji 往往依赖 **彩色** 字形与独立回退字体。本示例在 [第 15 课 — 文本](/zh/guide/lesson-015) 的基础上，在同一段字符串中混合多码点序列。

与公式或 CJK 混排时请核对行高与基线。

<a href="/guide/lesson-015">Draw text</a>

<script setup>
import Emoji from '../../components/Emoji.vue'
</script>

<Emoji />

```ts
const text = new Text({
    x: 50,
    y: 100,
    content: 'Hello, world! \n🌹🌍🌞🌛',
    fontSize: 30,
    fill: '#F67676',
});
```
