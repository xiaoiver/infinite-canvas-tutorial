---
outline: deep
---
<script setup>
import YogaGap from '../../components/YogaGap.vue'
import YogaFlexBasisGrowShrink from '../../components/YogaFlexBasisGrowShrink.vue'
import YogaAlignItemsJustifyContent from '../../components/YogaAlignItemsJustifyContent.vue'
import YogaMinMaxWidthHeight from '../../components/YogaMinMaxWidthHeight.vue'
</script>

## AlignItems & JustifyContent {#align-items-justify-content}

最常用的就是利用这两个属性完成居中：

<YogaAlignItemsJustifyContent />

## Gap {#gap}

下面这个例子展示了 `padding` 和 `gap` 的效果：

```ts
const parent = {
    id: 'yoga-gap-parent',
    type: 'rect',
    x: 100,
    y: 100,
    width: 200,
    height: 250,
    fill: 'grey',
    display: 'flex',
    padding: 10,
    flexWrap: 'wrap',
    gap: 10,
    zIndex: 0,
};
```

<YogaGap />

## Flex Basis, Grow, and Shrink {#flex-basis-grow-shrink}

[Flex Basis, Grow, and Shrink]

> Flex grow accepts any floating point value >= 0, with 0 being the default value. A container will distribute any remaining space among its children weighted by the child’s flex grow value.

<YogaFlexBasisGrowShrink />

## Min/Max Width and Height {#min-max-width-height}

[Min/Max Width and Height]

<YogaMinMaxWidthHeight />

[Flex Basis, Grow, and Shrink]: https://www.yogalayout.dev/docs/styling/flex-basis-grow-shrink
[Min/Max Width and Height]: https://www.yogalayout.dev/docs/styling/min-max-width-height
