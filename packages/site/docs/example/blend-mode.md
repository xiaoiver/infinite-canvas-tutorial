---
title: 'Node-level mix-blend-mode'
description: 'Composite gradient ellipses with CSS mix-blend-mode over a layered background.'
---

<!-- example-intro:en -->

# Node-level mix-blend-mode

This demo mirrors the [MDN mix-blend-mode](https://developer.mozilla.org/en-US/docs/Web/CSS/mix-blend-mode) RGB ellipse grid: each 150×150 cell has a two-layer gradient background and three rotated gradient ellipses. Every ellipse on a shape uses the same `blendMode` as its cell label and is composited with the content below (background plus earlier ellipses).

Supported modes in this grid: `normal`, `multiply`, `screen`, `overlay`, `difference`, `colorBurn`, `colorDodge`, and `softLight`.

## Interactive demo

<script setup>
import BlendMode from '../components/BlendMode.vue'
</script>

<BlendMode />

## Using blend modes

Set `blendMode` on a drawable node to mix its rendered fill, stroke and shadow with the canvas content below it. Modes follow the [W3C blending formulas](https://www.w3.org/TR/compositing-1/#blending), including transparent backdrops. `light` corresponds to CSS `lighten`; camel-case names such as `softLight` correspond to `soft-light`. `linearBurn` and `linearDodge` clamp the channel sum before alpha compositing and have no equivalent CSS keyword.

```ts
await api.edit(() => {
    api.updateNodes([
        {
            id: 'blended-rect',
            type: 'rect',
            x: 100,
            y: 100,
            width: 160,
            height: 120,
            fills: [{ type: 'solid', value: '#eb658f' }],
            blendMode: 'multiply',
            zIndex: 1,
        },
    ]);
});
```

`fills[i].blendMode` has a different scope: it mixes that paint with the earlier paints **inside the same shape**. Paints are ordered from bottom to top. GPU paint-layer blending currently supports rectangles, circles, ellipses and paths. Node blending also supports paths, strokes and text. Group isolation / blending a whole subtree is not implemented.
