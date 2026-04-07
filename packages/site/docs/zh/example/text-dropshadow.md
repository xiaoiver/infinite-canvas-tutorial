---
title: "文本投影"
description: "在复杂背景上通过模糊与偏移提升可读性。"
---
<!-- example-intro:zh -->

# 文本投影

文本阴影可提升照片、渐变等 **对比度**；参数语义接近 CSS 阴影，在低端 GPU 上需权衡模糊与性能。

可与 [第 16 课 — 文本高级特性](/zh/guide/lesson-016) 中的样式能力对照。

## 交互示例

<script setup>
import TextDropShadow from '../../components/TextDropShadow.vue'
</script>

在 SDF 纹理采样时使用偏移量实现阴影效果，可以参考：[Pixi.js DropShadow Filter]

<TextDropShadow />

```ts
const text = new Text({
    x: 50,
    y: 100,
    content: 'Hello, world!',
    fontSize: 30,
    fill: '#F67676',
    dropShadowColor: '#000000',
    dropShadowOffsetX: 2,
    dropShadowOffsetY: 2,
    dropShadowBlurRadius: 10,
});
```

[Pixi.js DropShadow Filter]: https://github.com/pixijs/filters/blob/main/src/drop-shadow/drop-shadow.frag#L13
