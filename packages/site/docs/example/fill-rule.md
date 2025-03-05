---
publish: false
---

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
