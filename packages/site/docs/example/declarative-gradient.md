---
title: "Declarative linear and radial gradients"
description: "Define gradients as data instead of imperative shader tweaks."
---
<!-- example-intro:en -->

# Declarative linear and radial gradients

Declarative gradients map cleanly to design tokens and theme systems—see [Lesson 17 — Gradient and pattern](/guide/lesson-017). Serialize stops to JSON for persistence.

Validate color stops in sRGB vs display-p3 when branding matters.

## Interactive demo

<script setup>
import DeclarativeGradient from '../components/DeclarativeGradient.vue'
</script>

<DeclarativeGradient />
