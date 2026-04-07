---
title: "Lasso selection"
description: "Select irregular regions by freehand outline."
---
<!-- example-intro:en -->

# Lasso selection

Lasso selection combines **path containment** tests with hit targets—see selection tooling in [Lesson 26](/guide/lesson-026). Optimize for many small objects via spatial indexes.

Differentiate tap vs drag thresholds to avoid accidental lassos.

## Interactive demo

<script setup>
import Lasso from '../components/Lasso.vue'
</script>

<Lasso />
