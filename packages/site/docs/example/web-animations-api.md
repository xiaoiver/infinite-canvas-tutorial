---
title: "Web Animations API with canvas"
description: "Drive properties with WAAPI timelines instead of ad-hoc rAF loops."
---
<!-- example-intro:en -->

# Web Animations API with canvas

The **Web Animations API** integrates with motion libraries and CSS timing—useful when coordinating canvas motion with DOM UI. Compare with manual loops from [Lesson 36](/guide/lesson-036) (animation lesson).

Prefer WAAPI when you need pause, seek, or playbackRate.

## Interactive demo

<script setup>
import WebAnimationsAPI from '../components/WebAnimationsAPI.vue'
</script>

Motion try to be compatible with Web Animations API, see: [Improvements to Web Animations API]

```ts
import { animate } from 'motion';

// @see https://motion.dev/docs/animate#transforms
await animate(rect, { angle: 360 }, { duration: 2 });
await animate(rect, { opacity: [0, 1] }, { duration: 1.5 });
await animate(
    rect,
    { scaleX: [1, 0], scaleY: [1, 0] },
    { duration: 1.5, repeat: Infinity, repeatType: 'reverse' },
);
```

<WebAnimationsAPI />

But there are some differences, for example:

-   `duration`, `delay` uses seconds instead of milliseconds
-   `iterations` -> `repeat`
-   `direction` -> `repeatType`
