---
title: '路径文本'
description: '沿曲线排布字形，用于徽章与流式标注。'
---

<!-- example-intro:zh -->

# 路径文本

路径文本需要按 **弧长** 采样并逐字旋转，适合圆形徽章与流向文字；性能与路径分段数量相关。

路径数学见 [第 12](/zh/guide/lesson-012)、[第 13 课](/zh/guide/lesson-013)。

## 交互示例

<script setup>
import TextPath from '../../components/TextPath.vue'
</script>

<TextPath locale="zh" />

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

拖动文字或蓝色手柄沿路径移动，拖动橙色控制点改变曲线。支持曲线、圆形和直线，以及两侧切换、对齐、字号、字距和基线距离调整。手柄可用方向键操作，Shift 加速，Esc 或触摸取消恢复拖动前状态。

`startOffset` 沿阅读方向移动，`pathOffset` 沿局部法线移动。开放路径溢出时隐藏字形，闭合路径可跨接缝且每行最多排一圈。包围盒随实际字形更新；SVG 导出保留逐字位置与旋转。排版细节与当前限制见[文本跟随路径](/zh/guide/lesson-016#text-along-path)。
