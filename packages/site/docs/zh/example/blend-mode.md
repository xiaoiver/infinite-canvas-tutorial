---
title: '节点级 mix-blend-mode'
description: '在多层渐变背景上，用 CSS mix-blend-mode 合成渐变椭圆。'
---

<!-- example-intro:zh -->

# 节点级 mix-blend-mode

本示例复刻 [MDN mix-blend-mode](https://developer.mozilla.org/zh-CN/docs/Web/CSS/mix-blend-mode) 的三色椭圆网格：每个 150×150 的单元格包含两层渐变背景，以及三个带旋转的渐变椭圆。同一单元格内的每个椭圆节点使用与下方标签相同的 `blendMode`，并与下层内容（背景及先前绘制的椭圆）进行合成。

本网格支持的混合模式：`normal`、`multiply`、`screen`、`overlay`、`difference`、`colorBurn`、`colorDodge`、`softLight`。

## 交互示例

<script setup>
import BlendMode from '../../components/BlendMode.vue'
</script>

<BlendMode />

## 使用混合模式

在可绘制节点上设置 `blendMode`，会把节点的填充、描边和阴影合成后，与画布中下方的内容混合。混合公式遵循 [W3C 标准](https://www.w3.org/TR/compositing-1/#blending)，包括背景透明的情况。`light` 对应 CSS 的 `lighten`，`softLight` 等驼峰命名对应 `soft-light`。`linearBurn` 和 `linearDodge` 会先限制颜色通道相加的结果，再计算透明度合成；它们没有对应的 CSS 关键字。

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

`fills[i].blendMode` 的作用范围不同：它将当前填充与**同一个图形内部**更靠下的填充混合。填充数组按从下到上排列。目前 GPU 填充层混合支持矩形、圆、椭圆和路径；节点级混合还支持路径、描边和文字。尚未实现将整个分组子树隔离后统一混合。
