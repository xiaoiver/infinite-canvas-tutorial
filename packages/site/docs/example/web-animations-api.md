---
publish: false
---

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
