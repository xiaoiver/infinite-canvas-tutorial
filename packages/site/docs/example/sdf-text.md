---
title: "Text with a distance-field shader"
description: "Render crisp text at multiple sizes using SDF techniques."
---
<!-- example-intro:en -->

# Text with a distance-field shader

Signed distance fields (**SDF**) scale text without jagged edges when mip-mapping and filtering are set up carefully. This ties into the broader text pipeline in [Lesson 15](/guide/lesson-015) and [Lesson 16](/guide/lesson-016).

Compare against MSDF and bitmap-font approaches on the same string for your target DPI.

<a href="/guide/lesson-015">Draw text</a>

<script setup>
import SDFText from '../components/SDFText.vue'
</script>

<SDFText />
