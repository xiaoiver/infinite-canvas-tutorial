---
title: "Embed HTML content on the canvas"
description: "Place DOM subtrees that pan and zoom with the camera."
---
<!-- example-intro:en -->

# Embed HTML content on the canvas

Embedding **HTML** bridges design tools and the web platform—see [Lesson 29 — Embedding HTML content](/guide/lesson-029). Mind stacking contexts, focus rings, and accessibility when mixing DOM with canvas layers.

Throttle reflows when animating transforms.

## Interactive demo

<script setup>
import HTML from '../components/HTML.vue'
</script>

We add it to a special shape type that renders the HTML content directly.
Try copying and pasting some code from a VSCode file.

<HTML />
