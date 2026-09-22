---
title: "Nested scene graph: a simple solar system"
description: "Animate nested Group nodes for sun, Earth orbit, and moon orbit on an infinite canvas using hierarchical transforms."
---
<!-- example-intro:en -->

# Nested scene graph: a simple solar system

This example shows how a **scene graph** composes rotation and translation: the root group rotates, child groups represent orbits, and circles represent celestial bodies. It is a compact illustration of parent–child transforms and per-frame updates from [Lesson 3 — Scene graph and transform](/guide/lesson-003).

The demo runs inside `<ic-canvas>` and updates transforms on each frame, which is the same mental model as building more complex diagrams or games on an infinite canvas.

## Interactive demo

<script setup>
import SolarSystem from '../components/SolarSystem.vue'
</script>

<SolarSystem />
