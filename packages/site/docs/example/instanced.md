---
title: "Instanced drawing to batch similar geometry"
description: "Pack many similar primitives into fewer draw calls using instancing."
---
<!-- example-intro:en -->

# Instanced drawing to batch similar geometry

When you render large counts of **similar** shapes (stars, dots, repeated icons), instancing amortizes draw-call overhead. This demo connects to the same performance themes as [Lesson 8](/guide/lesson-008).

Compare frame time with and without instancing when stress-testing your scene.

We can reduce the number of draw calls with instanced, see:
<a href="/guide/lesson-008">Performace optimazation</a>

<script setup>
import Instanced from '../components/Instanced.vue'
</script>

<Instanced />
