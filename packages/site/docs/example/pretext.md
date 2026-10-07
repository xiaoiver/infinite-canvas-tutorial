---
title: 'Text layout with Pretext'
description: 'Explore ECS text wrapping, glyph rendering, and editing.'
---

<!-- example-intro:en -->

# Text layout with Pretext

**Pretext** supplies line breaking for the ECS text layout pipeline. Font metrics and SDF glyph rendering are handled separately by the renderer. Pretext does not perform glyph shaping or bidirectional reordering; the current Hebrew/Arabic path retains the existing fallback.

## Interactive demo

<script setup>
import Pretext from '../components/Pretext.vue'
</script>

Select text to resize it with the corner handles, or drag outside a corner to rotate it. Double-click to edit the text in place. Resizing reuses the SDF atlas when only the display font size changes.

See [Pretext] for the upstream layout APIs.

<Pretext />

[Pretext]: https://github.com/chenglou/pretext
