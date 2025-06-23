---
publish: false
title: 一种字体生成艺术效果
description: generative-art fonts
---

<script setup>
import Signature from '../../components/Signature.vue'
</script>

周末在沪申美术馆看了松赞隐秘之门展览，除了上田义彦的摄影作品，被一组作品深深打动。下面的介绍来自：[隐秘之门｜廖斐]

> 在此次展出的两件作品《文殊菩萨》与《大威德金刚》中，廖斐以理性的线条系统和重复性的结构堆叠展开了一场对“书写”与“图像”的重新思考。乍看之下，作品中似乎隐含文字，却又无法确指任何明确的语义，观者在辨识与迷失之间反复摇摆。这种处理方法巧妙地脱离了语言的表意功能，将“字”还原为纯粹的形、结构乃至某种精神图腾，令作品获得近乎禅意般的指向。

![文殊菩萨 廖斐 53.2x38cm 亚克力板 马克笔 2023 & 大威德金刚 廖斐 53.2x38cm 亚克力板 马克笔 2023](/liaofei.png)

看的过程中我就在想能否通过现有的渲染技术来大致实现这样的效果。当然，在现场看过会知道这组作品是由多层材料组成的，最顶层是一块略带磨砂质感的亚克力板，让底层的文字和网格呈现一种朦胧的质感，显然是无法通过平面渲染技术呈现的。

![由多层结构组成的作品](/liaofei-photo.jpg)

下面是我实现的效果，可以输入你喜欢的文字，也可以选择导出图片：

<Signature />

接下来我想详细介绍其中使用的技术。

## 网格和文字渲染 {#render-grid-and-text}

最底层的网格部分，在 [课程 5 - 绘制网格] 中我们已经介绍过了，这里不再赘述。关于文本的渲染，在 [课程 15 - 绘制文本] 中我们介绍了 SDF 渲染技术，我们选择取消填充，保留彩色的描边。

使用 [LxgwWenKai] 开源中文字体。

## 渲染相交区域 {#intersect}

我们希望计算两个文字相交的若干区域，使用不同于文字的颜色或者纹理渲染它们。

在 [课程 16 - 获取文本路径] 中我们介绍过使用 [opentype.js] 进行 Shaping，获得文字的路径：

```ts
import opentype from 'opentype.js';

const buffer = await(
    await fetch('/fonts/LXGWWenKaiLite-Light.ttf'),
).arrayBuffer();
const font = opentype.parse(buffer);
font.getPath(char, 0, 0, 300).commands; // SVGPath
```

接下来需要将 SVGPath 转换成多边形，便于后续两个多边形间的布尔运算。当然这种转换不是无损的，涉及到采样精度，使用 [svg-path-properties] 可以做到：

```ts
import { svgPathProperties } from 'svg-path-properties';

const properties = new svgPathProperties(path);
const length = properties.getTotalLength();

const numPoints = 100; // 根据需要调整精度
const polygon: [number, number][] = [];
for (let i = 0; i <= numPoints; i++) {
    const point = properties.getPointAtLength((i / numPoints) * length);
    polygon.push([point.x, point.y]);
}
```

使用 [ClipperLib] 进行多边形间的布尔运算。

[隐秘之门｜廖斐]: https://mp.weixin.qq.com/s/2GmvjFvA7NoRAOGacg-3fA
[LxgwWenKai]: https://github.com/lxgw/LxgwWenKai
[课程 5 - 绘制网格]: /zh/guide/lesson-005
[课程 15 - 绘制文本]: /zh/guide/lesson-015
[课程 16 - 获取文本路径]: /zh/guide/lesson-016#opentypejs
[opentype.js]: https://github.com/opentypejs/opentype.js
[ClipperLib]: https://github.com/junmer/clipper-lib
[svg-path-properties]: https://github.com/rveciana/svg-path-properties
