---
title: "Laser pointer tool"
description: "Ephemeral highlight for presentations without mutating the document."
---
<!-- example-intro:en -->

# Laser pointer tool

Laser pointers should **not** commit geometry—ideal for live sessions ([Lesson 25](/guide/lesson-025)). Fade-out timing and GPU cost stay small.

Offer a toggle to hide lasers in exported recordings if needed.

## Interactive demo

<script setup>
import LaserPointer from '../components/LaserPointer.vue'
</script>

<LaserPointer />
