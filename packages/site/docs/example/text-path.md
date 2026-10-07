---
title: 'Text on a path'
description: 'Place glyphs along curves for badges and annotations.'
---

<!-- example-intro:en -->

# Text on a path

Text on a path needs **arc length** sampling and rotation per glyph. Use it for circular badges and flow labels; performance scales with segment count.

See vector path math in [Lesson 12](/guide/lesson-012) and [Lesson 13](/guide/lesson-013).

## Interactive demo

<script setup>
import EcsTextPath from '../components/EcsTextPath.vue'
import TextPath from '../components/TextPath.vue'
</script>

### ECS editor

<EcsTextPath />

ECS `TextSerializedNode` now supports `path`, `side`, `startOffset` and `pathOffset`. Update them through `api.edit()` for undo/redo and document JSON persistence. Path coordinates and `anchorX/anchorY` share the text's local coordinate system. Transformer resizing and flipping transform the curve and glyphs together, preserving font size and the glyph atlas.

```ts
await api.edit(() =>
    api.updateNode({
        id: 'path-label',
        type: 'text',
        content: 'Text follows your curve',
        fontFamily: 'sans-serif',
        fontSize: 32,
        anchorX: 0,
        anchorY: 0,
        path: 'M40 230C160 35 440 35 560 230',
        textAlign: 'center',
        side: 'left',
        startOffset: 0,
        pathOffset: 0,
        fills: [{ type: 'solid', value: '#e65b5b' }],
    }),
);
```

Picking tests each rotated glyph rectangle, leaving the empty area inside a curve unselected. Double-click opens a straight textarea with the object's rotation and scale; committing restores path layout. Curved carets, text selection along the curve and path control point editing are not provided in ECS yet. SVG export preserves appearance with per-glyph positions and rotations; reimporting SVG does not restore the editable path relationship.

This implementation supports the default SDF/MSDF renderer; the Vello backend does not yet support path text.

### Core path control demo

<TextPath />

```ts
const text = new Text({
    x: 0,
    y: 0,
    content: 'Text follows your curve',
    fontSize: 30,
    fill: '#F67676',
    fontFamily: 'sans-serif',
    path: 'M65 220C170 35 430 35 535 220',
    textAlign: 'center',
    side: 'left',
    startOffset: 0,
    pathOffset: 0,
    letterSpacing: 1,
});
```

Drag the text or blue handle along the path, and drag orange control points to reshape it. Choose a curve, circle or line and adjust side, alignment, size, spacing and baseline distance. Handles support arrow keys, Shift for larger steps and Esc or touch cancellation to restore the starting state.

`startOffset` moves along the reading direction; `pathOffset` moves along its local normal. Open paths omit overflowing glyphs. Closed paths can cross the seam with at most one lap per line. Bounds follow the glyphs, and SVG export preserves their positions and rotations. See [Text Along Path](/guide/lesson-016#text-along-path) for layout details and current limitations.
