---
title: "Underline and text decorations"
description: "Apply underlines, skips, and thickness consistent with typographic norms."
---
<!-- example-intro:en -->

# Underline and text decorations

Decorations participate in **selection**, **accessibility**, and export to PDF/SVG. This sample isolates decoration parameters for experimentation.

Match platform conventions when mirroring native text fields.

## Interactive demo

<script setup>
import TextDecoration from '../components/TextDecoration.vue'
</script>

<TextDecoration />

```ts
const text = new Text({
    x: 50,
    y: 100,
    content: "I'd far rather be\nhappy than right any day.",
    fontSize: 45,
    fill: '#F67676',
    decorationColor: 'black',
    decorationLine: 'underline',
    decorationStyle: 'wavy',
    decorationThickness: 10,
});
```
