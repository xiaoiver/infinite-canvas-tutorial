---
outline: deep
description: 'Implement selection tools.'
publish: false
---

<script setup>
import MultiSelection from '../components/MultiSelection.vue'
</script>

# Lesson 26 - Selection tool

In [Lesson 14 - Selection Mode] we only implemented simple click-to-select functionality for individual shapes. In this lesson, we will continue to improve the selection tool by adding multi-selection, marquee selection, and lasso functionality.

## Multi-Selection {#multi-selection}

Based on individual click selection, holding <kbd>Shift</kbd> allows adding/removing additional shapes to the current selection.

![Hold <kbd>Shift</kbd> to select multiple layers in Figma](https://d33v4339jhl8k0.cloudfront.net/docs/assets/5aa962fe2c7d3a2c4983093d/images/5c8042572c7d3a0cb93253d5/file-TQrRIcwMNR.gif)

In selection mode, we determine whether to preserve the current selection based on the `input.shiftKey` state (whether <kbd>Shift</kbd> is pressed): if not pressed, switch to single selection; if pressed, add the target shape to the existing selection:

```ts
if (selection.mode === SelectionMode.SELECT) {
    if (layersSelected.length > 1 && layersSelected.includes(selected.id)) {
        // deselect if already selected in a group
        api.deselectNodes([selected]);
    } else {
        api.selectNodes([selected], input.shiftKey); // whether to add to existed selection
    }
}
```

In [Lesson 21 - Transformer] we implemented single shape selection. Next, we need to add a Group display for multiple selected shapes. Unlike the single-selection Transformer, the multi-selection Group doesn't need to consider `rotation` and `scale`.

```ts
export class RenderTransformer extends System {
    getOBB(camera: Entity): OBB {
        const { selecteds } = camera.read(Transformable);

        // Single selected, keep the original OBB include rotation & scale.
        if (selecteds.length === 1 && selecteds[0].has(ComputedBounds)) {
            const { obb } = selecteds[0].read(ComputedBounds);
            return obb;
        }

        // [!code ++]
        if (selecteds.length > 1) {
            // [!code ++]
        }
    }
}
```

The effect is as follows. The logic for transforming all selected shapes during resize was already introduced in [Lesson 21 - Transform Shapes], so we won't repeat it here:

<MultiSelection />

## Marquee Selection {#marquee-selection}

The following image is from [Select layers and objects in Figma]

![Selection marquee in Figma](https://d33v4339jhl8k0.cloudfront.net/docs/assets/5aa962fe2c7d3a2c4983093d/images/5c8042ec04286350d088ba04/file-tAFIn9Cimd.gif)

This marquee selection tool is called "marquee", see: [Make selections with the Rectangular Marquee tool]. We call the formed rectangular area a Brush.

When marquee selection ends (mouse up), we first need to hide the Brush rectangle (we'll see its implementation in the next section), then use the fast picking method introduced in [Lesson 8 - Using Spatial Indexing for Acceleration]. It's worth noting that since the rectangle's width and height might be negative (depending on drag direction), we need to perform some calculations to ensure the BBox is valid:

```ts
if (input.pointerUpTrigger) {
    if (selection.mode === SelectionMode.BRUSH) {
        // Hide Brush...

        if (selection.brush) {
            const { x, y, width, height } = selection.brush.read(Rect);
            // Make a valid BBox
            const minX = Math.min(x, x + width);
            const minY = Math.min(y, y + height);
            const maxX = Math.max(x, x + width);
            const maxY = Math.max(y, y + height);
            const selecteds = api
                .elementsFromBBox(minX, minY, maxX, maxY) // Use space index
                .filter((e) => !e.has(UI))
                .map((e) => api.getNodeByEntity(e));
            api.selectNodes(selecteds); // Finish selection
        }
    }
}
```

During the marquee selection process, we also want to show the selection status in real-time through highlighting and Transformer. Based on the picking and selection logic above, we add highlighting:

![Highlight when brushing](/brush.gif)

```ts
api.selectNodes(selecteds);
// [!code ++]
if (needHighlight) {
    api.highlightNodes(selecteds); // [!code ++]
}
```

## Deselect with Esc {#deselect-with-esc}

Pressing <kbd>Esc</kbd> in selected state will cancel the selection. Additionally, during marquee selection, we need to hide the Brush:

```ts
if (input.key === 'Escape') {
    api.selectNodes([]);
    if (selection.mode === SelectionMode.BRUSH) {
        this.hideBrush(selection);
    }
}
```

## [WIP] Lasso Tool {#lasso-selection}

[lasso-tool-figma]

[Lesson 14 - Selection Mode]: /guide/lesson-014#select-mode
[Lesson 21 - Transformer]: /guide/lesson-021
[Lesson 21 - Transform Shapes]: /guide/lesson-021#transform-shape
[Select layers and objects in Figma]: https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects
[Make selections with the Rectangular Marquee tool]: https://helpx.adobe.com/photoshop/using/tool-techniques/rectangular-marquee-tool.html
[Lesson 8 - Using Spatial Indexing for Acceleration]: /guide/lesson-008#using-spatial-indexing
[lasso-tool-figma]: https://github.com/kernel-picnic/lasso-tool-figma
