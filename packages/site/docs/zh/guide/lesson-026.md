---
outline: deep
description: '实现选择工具。'
head:
    - ['meta', { property: 'og:title', content: '课程 26 - 选择工具' }]
---

<script setup>
import MultiSelection from '../../components/MultiSelection.vue'
</script>

# 课程 26 - 选择工具

在 [课程 14 - 选择模式] 中我们仅实现了简单的点击图形单独选中的功能。本节课我们会继续完善这个选择工具，增加多选、框选和套索功能。

## 多选 {#multi-selection}

在点击单独选择的基础上，通过按住 <kbd>Shift</kbd> 可以在当前选择的基础上，新增/删除另外的图形。

![Hold <kbd>Shift</kbd> to select multiple layers in Figma](https://d33v4339jhl8k0.cloudfront.net/docs/assets/5aa962fe2c7d3a2c4983093d/images/5c8042572c7d3a0cb93253d5/file-TQrRIcwMNR.gif)

在选择模式中，我们根据 `input.shiftKey` 即 <kbd>Shift</kbd> 的按下状态，决定是否需要保留当前的选择：如果未按下则切换单选；如果按下则将目标图形加入已有的选择中：

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

在 [课程 21 - Transformer] 中我们实现了单个图形，接下来需要为多个选中的图形增加一个 Group 展示。和单选的 Transformer 不同，多选形成的 Group 不需要考虑 `rotation` 和 `scale`。

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

效果如下，Resize 时对选中的所有图形进行变换的逻辑已经在 [课程 21 - 变换图形] 中介绍过，这里不再赘述：

<MultiSelection />

## 框选 {#marquee-selection}

下图来自 [Select layers and objects in Figma]

![Selection marquee in Figma](https://d33v4339jhl8k0.cloudfront.net/docs/assets/5aa962fe2c7d3a2c4983093d/images/5c8042ec04286350d088ba04/file-tAFIn9Cimd.gif)

这个框选工具被称作 “marquee”，详见：[Make selections with the Rectangular Marquee tool]，我们把形成的矩形区域称作 Brush。

在框选结束（鼠标抬起）时，首先需要隐藏 Brush 矩形（在下一小节我们会看到它的实现），然后使用 [课程 8 - 使用空间索引加速] 中介绍的快速拾取方法。值得注意的是，由于该矩形的宽高有可能为负数（取决于拖拽方向），我们需要进行一些计算保证 BBox 是合法的：

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

在框选过程中，我们也希望实时通过高亮和 Transformer 展示选中情况，在上面的拾取和选中逻辑基础上，增加高亮：

![Highlight when brushing](/brush.gif)

```ts
api.selectNodes(selecteds);
// [!code ++]
if (needHighlight) {
    api.highlightNodes(selecteds); // [!code ++]
}
```

## 通过 Esc 取消选择 {#deselect-with-esc}

选中状态下按 <kbd>Esc</kbd> 会取消选择，另外在框选过程中需要隐藏掉 Brush：

```ts
if (input.key === 'Escape') {
    api.selectNodes([]);
    if (selection.mode === SelectionMode.BRUSH) {
        this.hideBrush(selection);
    }
}
```

## [WIP] 套索工具 {#lasso-selection}

相较于框选工具，套索工具可以通过不规则的多边形完成更精细的选取。

-   [Feature Request: Lasso Selection (free selection) in Excalidraw]
-   [lasso-tool-figma]

### 绘制套索 {#draw-lasso}

在 [课程 25 - 铅笔工具] 中我们已经介绍过如何自由绘制折线。

### 多边形的相交性检测 {#polygon-intersection}

[课程 14 - 选择模式]: /zh/guide/lesson-014#select-mode
[课程 21 - Transformer]: /zh/guide/lesson-021
[课程 21 - 变换图形]: /zh/guide/lesson-021#transform-shape
[Select layers and objects in Figma]: https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects
[Make selections with the Rectangular Marquee tool]: https://helpx.adobe.com/photoshop/using/tool-techniques/rectangular-marquee-tool.html
[课程 8 - 使用空间索引加速]: /zh/guide/lesson-008#using-spatial-indexing
[lasso-tool-figma]: https://github.com/kernel-picnic/lasso-tool-figma
[Feature Request: Lasso Selection (free selection) in Excalidraw]: https://github.com/excalidraw/excalidraw/issues/6350
[课程 25 - 铅笔工具]: /zh/guide/lesson-025#pencil-tool
