---
title: "画布上的图像处理"
description: "在像素域试验卷积类效果，用于创意滤镜。"
---
<!-- example-intro:zh -->

# 画布上的图像处理

滤镜要么读回 CPU 处理，要么走 GPU Pass；本页偏沙盒，生产环境可优先考虑计算着色器或 WASM，见 [第 30 课 — 后处理](/zh/guide/lesson-030)。

串联滤镜时注意 **伽马/色彩空间**。

## 交互示例

<script setup>
import ImageProcessing from '../../components/ImageProcessing.vue'
</script>

```ts
const node = {
    id: '1',
    type: 'rect',
    fill: 'https://v3b.fal.media/files/b/tiger/v1lf1EcPP1X1pw_YOKM4o.jpg',
    x: 50,
    y: 50,
    width: 200,
    height: 200,
    lockAspectRatio: true,
    filter: 'noise(0.6)',
};
```

<ImageProcessing />
