---
publish: false
---

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
