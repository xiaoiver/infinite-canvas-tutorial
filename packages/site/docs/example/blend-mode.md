---
title: 'Node-level mix-blend-mode'
description: 'Composite gradient ellipses with CSS mix-blend-mode over a layered background.'
---

<!-- example-intro:en -->

# Node-level mix-blend-mode

This demo mirrors the [MDN mix-blend-mode](https://developer.mozilla.org/en-US/docs/Web/CSS/mix-blend-mode) RGB ellipse grid: each 150×150 cell has a two-layer gradient background and three rotated gradient ellipses. Every ellipse on a shape uses the same `blendMode` as its cell label and is composited with the content below (background plus earlier ellipses).

Supported modes in this grid: `normal`, `multiply`, `screen`, `overlay`, `difference`, `colorBurn`, `colorDodge`, and `softLight`.

## Interactive demo

<script setup>
import BlendMode from '../components/BlendMode.vue'
</script>

<BlendMode />
