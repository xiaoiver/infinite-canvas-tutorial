---
publish: false
---

<script setup>
import Opentype from '../../components/Opentype.vue'
</script>

[使用 Opentype.js 进行 Shaping](/zh/guide/lesson-016#opentype-js)

<Opentype />

Opentype.js 中可以获取文本的矢量路径 [path-commands]，我们就可以使用 Path 来绘制：

```ts
import opentype from 'opentype.js';

const buffer = await(
    await window.fetch('/fonts/NotoSans-Regular.ttf'),
).arrayBuffer();
const font = opentype.parse(buffer);

font.getPath('Hello, World!', 100, 100, 32).commands; // [{ type: 'M', x: 100, y: 100 }, { type: 'l', x: 100, y: 100 }]
```

[path-commands]: https://github.com/opentypejs/opentype.js?tab=readme-ov-file#path-commands
