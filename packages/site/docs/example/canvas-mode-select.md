---
title: "Switch canvas interaction modes"
description: "Toggle select, pan, draw, and other modes from a single surface."
---
<!-- example-intro:en -->

# Switch canvas interaction modes

Mode switching is central to whiteboard UX—see [Lesson 14](/guide/lesson-014) for auxiliary UI and [Lesson 25](/guide/lesson-025) for drawing tools. This control surface keeps modes explicit for users.

Persist the active mode per document when restoring sessions.

[Canvas mode - Select]

<script setup>
import SelectCanvasMode from '../components/SelectCanvasMode.vue'
</script>

<SelectCanvasMode />

[Canvas mode - Select]: /guide/lesson-014#select-mode
