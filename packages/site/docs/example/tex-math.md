---
title: "TeX math on the canvas"
description: "Render LaTeX formulas to textures or paths for STEM content."
---
<!-- example-intro:en -->

# TeX math on the canvas

STEM whiteboards often need **TeX**. Rasterizing formulas to images is straightforward; path extraction enables sharper zoom at the cost of complexity.

Cache results per formula string to keep interaction smooth.

## Interactive demo

<script setup>
import TeXMath from '../components/TeXMath.vue'
</script>

<TeXMath />
