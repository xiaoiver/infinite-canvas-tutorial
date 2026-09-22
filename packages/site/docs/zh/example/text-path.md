---
title: "路径文本"
description: "沿曲线排布字形，用于徽章与流式标注。"
---
<!-- example-intro:zh -->

# 路径文本

路径文本需要按 **弧长** 采样并逐字旋转，适合圆形徽章与流向文字；性能与路径分段数量相关。

路径数学见 [第 12](/zh/guide/lesson-012)、[第 13 课](/zh/guide/lesson-013)。

## 交互示例

<script setup>
import TextPath from '../../components/TextPath.vue'
</script>

<TextPath />

```ts
const text = new Text({
    x: 0,
    y: 0,
    content: 'Quick brown fox jumps over the lazy dog.',
    fontSize: 15,
    fill: '#F67676',
    fontFamily: 'sans-serif',
    path: 'M10,90 Q90,90 90,45 Q90,10 50,10 Q10,10 10,40 Q10,70 45,70 Q70,70 75,50',
});
```
