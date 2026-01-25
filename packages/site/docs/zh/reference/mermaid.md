---
outline: deep
---

<script setup>
import Mermaid from '../../components/Mermaid.vue'
import MermaidRough from '../../components/MermaidRough.vue'
</script>

该插件提供了一个工具方法，将 Mermaid 语法转换成画布的场景图：

```ts
import { parseMermaidToSerializedNodes } from '@infinite-canvas-tutorial/mermaid';

const nodes = await parseMermaidToSerializedNodes(
    'flowchart LR\n start-->stop',
);
api.runAtNextTick(() => {
    api.updateNodes(nodes);
});
```

目前仅支持简单的 `flowchart`

<Mermaid />

也可以很容易地转换成手绘风格：

<MermaidRough />
