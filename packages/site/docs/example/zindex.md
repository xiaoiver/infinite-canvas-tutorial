---
title: "Change stacking order (z-index)"
description: "Bring shapes forward or send them backward deterministically."
---
<!-- example-intro:en -->

# Change stacking order (z-index)

Order defines occlusion for overlapping shapes. **z-index** or sibling order must match user expectations from design tools—related to grouping in [Lesson 34](/guide/lesson-034).

After batch imports, normalize z-order to avoid hidden selections.

## Interactive demo

<script setup>
import ZIndex from '../components/ZIndex.vue'
</script>

Adjust `z-index` with bring forward and send back.

<ZIndex />
