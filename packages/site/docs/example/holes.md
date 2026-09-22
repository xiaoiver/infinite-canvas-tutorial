---
title: "Compound paths with holes"
description: "Use winding rules and subpaths to cut holes in filled regions."
---
<!-- example-intro:en -->

# Compound paths with holes

Boolean-like holes appear in icons, donuts, and masks. This sample exercises path construction where **outer** and **inner** contours interact—see fill rules in [Lesson 13](/guide/lesson-013) and clipping in [Lesson 34](/guide/lesson-034).

Test both even-odd and non-zero rules if your importer emits ambiguous geometry.

## Interactive demo

<script setup>
import Holes from '../components/Holes.vue'
</script>

In SVG, holes can be defined with a different clockwise direction than the outline. For example, in the path below, the outline is clockwise `M0 0 L100 0 L100 100 L0 100 Z`, and the two subsequent holes are counterclockwise:

```bash
M0 0 L100 0 L100 100 L0 100 Z M50 50 L50 75 L75 75 L75 50 Z M25 25 L25
```

You can also reverse the clockwise direction in your definition, for example: [Draw a hollow circle in SVG]. The key is that the hole's direction should be opposite to the outline's direction.

<Holes />

[Draw a hollow circle in SVG]: https://stackoverflow.com/questions/8193675/draw-a-hollow-circle-in-svg
