---
title: "Viewport culling to reduce draw load"
description: "Skip shapes outside the visible frustum so large scenes stay responsive."
---
<!-- example-intro:en -->

# Viewport culling to reduce draw load

**Frustum culling** avoids submitting geometry that cannot appear on screen. This sample visualizes which objects remain in the working set as you pan and zoom, tying directly to [Lesson 8 — Optimize performance](/guide/lesson-008).

Use it as a reference when you profile CPU/GPU time on boards with thousands of shapes.

We can reduce the number of draw calls with culling, see:
<a href="/guide/lesson-008">Performace optimazation</a>

<script setup>
import Culling from '../components/Culling.vue'
</script>

<Culling />
