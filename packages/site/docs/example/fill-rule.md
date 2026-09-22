---
title: "Even-odd vs non-zero fill rules"
description: "See how the same path geometry fills differently under each rule."
---
<!-- example-intro:en -->

# Even-odd vs non-zero fill rules

The **fill rule** decides which regions are inside a self-intersecting or nested path. Interactive design tools expose this as a first-class toggle—essential for predictable SVG import.

Pair this page with compound paths and holes when debugging unexpected fills.

## Interactive demo

<script setup>
import FillRule from '../components/FillRule.vue'
</script>

Same as [fill-rule] attribute in SVG, the left is `nonzero`, the right is `evenodd`.

<FillRule />

Since [earcut] is not supported self-intersecting paths well, we use [libtess.js] to tesselate the path.

```ts
const star = new Path({
    d: 'M150 0 L121 90 L198 35 L102 35 L179 90 Z',
    fill: '#F67676',
    fillRule: 'evenodd',
    tessellationMethod: TesselationMethod.LIBTESS, // instead of earcut
});
```

[fill-rule]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/fill-rule
[earcut]: https://github.com/mapbox/earcut
[libtess.js]: https://github.com/brendankenny/libtess.js
