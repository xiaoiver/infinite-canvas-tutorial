---
title: "Text shaping with HarfBuzz"
description: "Use HarfBuzz for complex scripts and OpenType features."
---
<!-- example-intro:en -->

# Text shaping with HarfBuzz

**HarfBuzz** is the industry-standard shaper. Wiring it to your text runs unlocks ligatures, kerning, and script-specific rules beyond simple codepoint→glyph mapping—see [Lesson 15](/guide/lesson-015).

Ship WASM builds with lazy loading to keep initial bundles small.

## Interactive demo

<script setup>
import Harfbuzz from '../components/Harfbuzz.vue'
</script>

<Harfbuzz />
