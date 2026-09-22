---
title: "Drag-and-drop images onto the canvas"
description: "Import raster assets from the desktop or browser tabs."
---
<!-- example-intro:en -->

# Drag-and-drop images onto the canvas

Drag-and-drop is the fastest way to bring references onto a board. Parse **files** and **items** from the drop event, then decode images asynchronously—see asset topics in [Lesson 10](/guide/lesson-010).

Sanitize size and dimensions to protect memory on large pastes.

## Interactive demo

<script setup>
import DragNDropImage from '../components/DragNDropImage.vue'
</script>

<DragNDropImage />
