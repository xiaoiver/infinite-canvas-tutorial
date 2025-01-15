---
publish: false
---

<script setup>
import Opentype from '../components/Opentype.vue'
</script>

<Opentype />

Opentype.js can get [path-commands], so that we can use Path to draw:

```ts
import opentype from 'opentype.js';

const buffer = await(
    await window.fetch('/fonts/NotoSans-Regular.ttf'),
).arrayBuffer();
const font = opentype.parse(buffer);

font.getPath('Hello, World!', 100, 100, 32).commands; // [{ type: 'M', x: 100, y: 100 }, { type: 'l', x: 100, y: 100 }]
```

[path-commands]: https://github.com/opentypejs/opentype.js?tab=readme-ov-file#path-commands
