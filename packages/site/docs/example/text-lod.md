---
title: 'Text LOD'
description: 'Compare full glyphs and small-text line proxies while zooming an ECS canvas.'
---

<!-- example-intro:en -->

# Text LOD

Zoom out of a text-heavy canvas to see ordinary labels become one solid proxy per nonempty line. This example explicitly enables LOD; the library default remains off.

<script setup>
import TextLOD from '../components/TextLOD.vue'
</script>

<TextLOD />

## Try the transition

1. Start with **Overview**. Toggle **Text LOD** to compare proxies and full glyphs at the same camera zoom.
2. From Overview, enter the **7 px hysteresis band**: the labels remain proxies. Choose **Detail**, then return to 7 px: they remain full text. Text enters proxy mode below 6 CSS px and returns to full above 8 CSS px.
3. Select a visible label or hover it to force full glyphs. Clear the selection to allow LOD again. Double-click a label to edit it.
4. Change the label count, pan, or resize the page. The counters report visible text objects using the original viewport culling result, including interaction overrides.

Screen font size is the 18 px font projected through this example's camera zoom, in **CSS pixels**, independently of device pixel ratio. The counts are text objects, not drawcalls, GPU timings or a performance claim. LOD reduces glyph work. Eligible proxies can also share an ordered instance page when their runtime `Renderable.batchable` flag is enabled; this example enables it for every label.

## Enable it in your canvas

```ts
api.setTextLODEnabled(true);

// Restore the existing full text rendering path.
api.setTextLODEnabled(false);
```

The setting belongs to this canvas at runtime and does not change document JSON, undo history or collaboration data. Selection, hovering and editing restore full text; picking and snapping retain the original geometry. Raster exports always use full glyphs. Complex styles, effects, clipping and unsupported text safely stay full.

Both text LOD (#674) and the ordered solid-shape batching improvements (#675) are implemented in `packages/ecs`. The same ordered planner now also supports text line proxies. It combines adjacent compatible objects, with at most 4,096 nonempty lines per page. Full text and unsupported styles remain independent rendering barriers.

This demo uses the ECS renderer. The older Core SDF text example has a separate rendering path; this switch does not configure it.

## Opt into proxy batching

`batchable` is an ECS runtime component field, not a document JSON attribute. Enable it inside an edit for a text node that already exists:

```ts
import { Renderable } from '@infinite-canvas-tutorial/ecs';

await api.edit(
    (editor) => {
        const node = editor.getNodeById('your-label');
        editor.getEntity(node).write(Renderable).batchable = true;
    },
    { capture: 'NEVER' },
);
```

The LOD switch remains opt-in. To compare independent proxies, set the runtime field back to `false` while leaving LOD enabled. Selection, hovering, editing and export still use full glyphs.
