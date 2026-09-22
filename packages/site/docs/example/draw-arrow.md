---
title: "Arrow tool"
description: "Create directed segments with arrowheads for diagrams."
---
<!-- example-intro:en -->

# Arrow tool

Arrows inherit polyline math from [Lesson 12](/guide/lesson-012) and styling from [Lesson 13](/guide/lesson-013). Tooling should preserve endpoint snapping and stroke styles.

Export arrows cleanly to SVG/PDF for documentation pipelines.

## Interactive demo

<script setup>
import DrawArrow from '../components/DrawArrow.vue'
</script>

<DrawArrow />
