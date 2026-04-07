---
title: "使用 Opentype.js 进行 Shaping"
description: "在纯 JS 环境中解析字体并布局，适合轻量部署。"
---
<!-- example-intro:zh -->

# 使用 Opentype.js 进行 Shaping

**Opentype.js** 在浏览器内解析字体，适合无法携带 HarfBuzz WASM 或需要快速原型的场景；复杂脚本覆盖与 HarfBuzz 可能有差异，请按目标语言验证。

换行与行盒请结合 Canvas 文本度量调整。

## 交互示例

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
