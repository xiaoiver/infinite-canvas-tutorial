---
title: "Load webfonts before painting text"
description: "Coordinate font loading with canvas render timing."
---
<!-- example-intro:en -->

# Load webfonts before painting text

FOIT/FOUT issues hit canvas just like DOM. **WebFontLoader** (or native `document.fonts`) should gate your first text draw—see [Lesson 15](/guide/lesson-015).

Preload critical fonts to avoid layout shift in collaborative sessions.

## Interactive demo

<script setup>
import WebFontLoader from '../components/WebFontLoader.vue'
</script>

<WebFontLoader />

```ts
import WebFont from 'webfontloader';

WebFont.load({
    google: {
        families: ['Gaegu'],
    },
    active: () => {
        const text = new Text({
            x: 150,
            y: 150,
            content: 'Hello, world',
            fontFamily: 'Gaegu',
            fontSize: 55,
            fill: '#F67676',
        });
        canvas.appendChild(text);
    },
});
```
