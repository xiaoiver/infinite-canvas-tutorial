---
publish: false
---

<script setup>
import WebAnimationsAPI from '../../components/WebAnimationsAPI.vue'
</script>

Motion 尽可能兼容了 Web Animations API，详见：[Improvements to Web Animations API]

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

但和 Web Animations API 还是有一些区别，例如：

-   `duration` 使用秒而非毫秒

[Improvements to Web Animations API]: https://motion.dev/docs/improvements-to-the-web-animations-api-dx
