---
publish: false
---

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
