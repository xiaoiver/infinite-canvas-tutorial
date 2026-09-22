---
title: "Import SVG paths into the canvas"
description: "Parse SVG content and map it to canvas paths and shapes."
---
<!-- example-intro:en -->

# Import SVG paths into the canvas

SVG is the lingua franca for 2D assets. Importing paths lets users bring logos and illustrations onto the board while preserving editability where possible—see also vector topics in [Lesson 22](/guide/lesson-022).

Handle viewBox, transforms, and unsupported elements explicitly in production importers.

## Interactive demo

<script setup>
import ImportSVG from '../components/ImportSVG.vue'
</script>

<ImportSVG />
