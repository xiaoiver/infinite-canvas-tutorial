---
title: "位图字体文本"
description: "使用预烘焙字形图集，换取轻量与可预期的性能。"
---
<!-- example-intro:zh -->

# 位图字体文本

**位图字体** 以灵活性换取速度与实现简单，适合游戏与 HUD。示例代码展示如何加载 XML/纹理对，并可切换字距观察度量差异。

若需要完整 Unicode 或 Web 字体流程，可再参考 HarfBuzz、Opentype.js 等示例。

移植自：<https://pixijs.com/8.x/examples/text/bitmap-text>

```ts
import { Text, loadBitmapFont } from '@infinite-canvas-tutorial/core';

const res = await fetch('/fonts/desyrel.xml');
const font = await loadBitmapFont.parse(await res.text());
const text = new Text({
    x: 50,
    y: 50,
    content: 'Hello, world',
    fontSize: 48,
    fill: '#F67676',
    fontFamily: 'Desyrel',
    bitmapFont: font,
});
canvas.appendChild(text);
```

可以通过 `bitmapFontKerning` 来控制是否开启 kerning

<script setup>
import BitmapFont from '../../components/BitmapFont.vue'
</script>

<BitmapFont />
