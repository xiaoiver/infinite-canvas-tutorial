---
title: "Wireframe overlay for layout debugging"
description: "Draw bounding guides to inspect alignment and spacing."
---
<!-- example-intro:en -->

# Wireframe overlay for layout debugging

Wireframes help verify **layout engines**, snapping, and padding without permanent ink. Use them while building [Lesson 33 — Layout engine](/guide/lesson-033) integrations or debugging misaligned frames.

Toggle overlays only in dev builds to avoid confusing end users.

Wireframe grid can help you debug the geometry, see: <a href="/guide/lesson-005">Draw wireframe</a>

<script setup>
import Wireframe from '../components/Wireframe.vue'
</script>

<Wireframe />
