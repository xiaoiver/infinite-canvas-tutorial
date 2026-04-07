---
title: "Bitmap font rendering"
description: "Use prebaked glyph atlases for lightweight, deterministic text."
---
<!-- example-intro:en -->

# Bitmap font rendering

**Bitmap fonts** trade flexibility for speed and simplicity—ideal for games and HUDs. The snippet shows loading an XML/texture pair and toggling kerning to see metric differences.

When you need full Unicode or webfont workflows, move toward HarfBuzz or Opentype.js examples below.

Ported from <https://pixijs.com/8.x/examples/text/bitmap-text>

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

You can toggle with `bitmapFontKerning` to see the difference.

<script setup>
import BitmapFont from '../components/BitmapFont.vue'
</script>

<BitmapFont />
