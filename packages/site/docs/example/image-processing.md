---
title: "Image processing filters on canvas pixels"
description: "Experiment with convolution-like operations for creative effects."
---
<!-- example-intro:en -->

# Image processing filters on canvas pixels

Filters touch **pixels**—either CPU readbacks or GPU passes. This sample is a sandbox; production pipelines should prefer compute shaders or WASM for throughput—see post-processing in [Lesson 30](/guide/lesson-030).

Mind color space (gamma) when chaining filters.

## Interactive demo

<script setup>
import ImageProcessing from '../components/ImageProcessing.vue'
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
