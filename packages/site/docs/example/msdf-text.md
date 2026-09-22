---
title: "MSDF text rendering"
description: "Multi-channel SDF preserves sharp corners better than single-channel SDF at oblique angles."
---
<!-- example-intro:en -->

# MSDF text rendering

**MSDF** improves on basic SDF for small sizes and diagonal strokes. Use this page next to the SDF and bitmap examples to pick a technique per use case.

Precompute atlases offline for large glyph sets to keep load times predictable.

[Use generated MSDF to render text](/guide/lesson-015#msdf). It can be seen that, compared to the implementation of SDF, the text edges remain sharp even after magnification.

<script setup>
import MSDFText from '../components/MSDFText.vue'
</script>

<MSDFText />
