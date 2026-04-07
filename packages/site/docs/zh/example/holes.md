---
title: "带孔洞的复合 Path"
description: "用子路径与绕向规则在填充区域中挖出孔洞。"
---
<!-- example-intro:zh -->

# 带孔洞的复合 Path

带孔图形常见于图标、圆环与遮罩。本示例练习 **外轮廓与内轮廓** 的组合，可与 [第 13 课](/zh/guide/lesson-013) 的路径与 [第 34 课 — Group/Frame 与裁切](/zh/guide/lesson-034) 对照。

若几何来自导入器，请用 even-odd 与 non-zero 两种规则交叉验证。

## 交互示例

<script setup>
import Holes from '../../components/Holes.vue'
</script>

在 SVG 中可以这样定义孔洞，与轮廓的时针方向不同。比如下面路径中的轮廓为顺时针 `M0 0 L100 0 L100 100 L0 100 Z`，后续的两个孔洞就是逆时针方向：

```bash
M0 0 L100 0 L100 100 L0 100 Z M50 50 L50 75 L75 75 L75 50 Z M25 25 L25
```

当然也可以将时针方向反过来定义，例如：[Draw a hollow circle in SVG]，总之孔洞的时针方向与轮廓相反即可。

<Holes />

[Draw a hollow circle in SVG]: https://stackoverflow.com/questions/8193675/draw-a-hollow-circle-in-svg
