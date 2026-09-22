---
title: "文本描边"
description: "用描边宽度与连接样式制作空心字或双色标签。"
---
<!-- example-intro:zh -->

# 文本描边

描边文本常见于贴纸、地图与界面装饰。需控制 **宽度**、**连接** 以及填充/描边顺序，避免尖角瑕疵。

若描边改到 GPU/SDF 管线，请与着色器行为交叉验证。

## 交互示例

<script setup>
import TextStroke from '../../components/TextStroke.vue'
</script>

<TextStroke />

```ts
const text = new Text({
    x: 50,
    y: 100,
    content: 'Hello, world!',
    fontSize: 45,
    fill: '#F67676',
    stroke: 'black',
    strokeWidth: 8,
});
```
