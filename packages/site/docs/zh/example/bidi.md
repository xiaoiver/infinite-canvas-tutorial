---
title: "双向文字（Bidi）排版"
description: "在同一段落中混合从左到右与从右到左的书写方向。"
---
<!-- example-intro:zh -->

# 双向文字（Bidi）排版

**Bidi** 排版在阿语、希伯来语与英文混排时不可或缺，字形层面常依赖 HarfBuzz 等 shaping，本页展示与画布的集成。

请用混合方向段落测试光标移动与选区行为。

使用 [bidi-js] 处理双向文本。

<script setup>
import Bidi from '../../components/Bidi.vue'
</script>

<Bidi />

下面的例子来自 [What HarfBuzz doesn't do] 和 [Improving Arabic and Hebrew text in map labels]

```ts
const text = new Text({
    x: 50,
    y: 100,
    content: 'ABCג ב אDEF',
    fontSize: 30,
    fill: '#F67676',
});

const text2 = new Text({
    x: 50,
    y: 150,
    content: 'سلام',
    fontSize: 30,
    fill: '#F67676',
});
```

[bidi-js]: https://github.com/lojjic/bidi-js
[Improving Arabic and Hebrew text in map labels]: https://blog.mapbox.com/improving-arabic-and-hebrew-text-in-map-labels-fd184cf5ebd1
[What HarfBuzz doesn't do]: https://harfbuzz.github.io/what-harfbuzz-doesnt-do.html
