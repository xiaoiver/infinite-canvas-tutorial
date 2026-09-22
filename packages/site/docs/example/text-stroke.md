---
title: "Outlined text (stroke)"
description: "Draw hollow or dual-tone labels with stroke width and join style."
---
<!-- example-intro:en -->

# Outlined text (stroke)

Stroked text is common for stickers, maps, and UI chrome. Control **width**, **join**, and fill/stroke ordering to avoid artifacts at sharp corners.

Validate against your SDF/MSDF shader if you move outlines off the CPU.

## Interactive demo

<script setup>
import TextStroke from '../components/TextStroke.vue'
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
