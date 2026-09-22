---
title: "填充规则：even-odd 与 non-zero"
description: "同一几何在不同填充规则下会得到不同填充区域。"
---
<!-- example-intro:zh -->

# 填充规则：even-odd 与 non-zero

**填充规则** 决定自相交或嵌套路径的「内部」区域，交互设计工具通常提供显式切换，对 SVG 导入的可预期性很重要。

可与带孔复合路径、导入器问题对照排查异常填充。

## 交互示例

<script setup>
import FillRule from '../../components/FillRule.vue'
</script>

和 SVG 中的 [fill-rule] 属性一致，左边是 `nonzero`，右边是 `evenodd`.

<FillRule />

由于 [earcut] 不支持自相交路径，我们使用 [libtess.js] 来三角化路径。

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
