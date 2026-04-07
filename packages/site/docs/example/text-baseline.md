---
title: "Canvas text baseline alignment"
description: "Compare alphabetic, middle, and other baselines side by side."
---
<!-- example-intro:en -->

# Canvas text baseline alignment

The **textBaseline** property changes where glyphs sit relative to a y-coordinate—critical when mixing text with shapes or icons. MDN documents the full enum; this demo renders two canvases for comparison.

Align labels to vector geometry using explicit baselines rather than magic offsets.

## Interactive demo

<script setup>
import TextBaseline from '../components/TextBaseline.vue'
import TextBaseline2 from '../components/TextBaseline2.vue'
</script>

<TextBaseline />

[textBaseline]

<TextBaseline2 />

[textBaseline]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline
