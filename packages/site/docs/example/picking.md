---
title: "Accelerate hit-testing with a spatial index"
description: "Use RBush-backed queries so picking stays fast on dense boards."
---
<!-- example-intro:en -->

# Accelerate hit-testing with a spatial index

Picking must stay **O(log n)** or better when thousands of bounds overlap the cursor. This example shows how a spatial index narrows candidates before precise tests, aligned with interaction work in [Lesson 6](/guide/lesson-006) and performance tuning in [Lesson 8](/guide/lesson-008).

Use it when debugging “missed clicks” or hover lag on large documents.

We can enhance picking performance with RBush, see:
<a href="/guide/lesson-008">Performace optimazation</a>

<script setup>
import Picking from '../components/Picking.vue'
</script>

<Picking />
