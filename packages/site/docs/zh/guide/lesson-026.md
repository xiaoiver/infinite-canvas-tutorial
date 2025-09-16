---
outline: deep
description: '实现选择工具。'
publish: false
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

## 框选 {#brush-selection}

## 套索工具 {#lasso-selection}

[课程 14 - 选择模式]: /zh/guide/lesson-014#select-mode
[课程 21 - Transformer]: /zh/guide/lesson-021
[课程 21 - 变换图形]: /zh/guide/lesson-021#transform-shape
[lasso-tool-figma]: https://github.com/kernel-picnic/lasso-tool-figma
