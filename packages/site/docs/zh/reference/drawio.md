---
outline: deep
---

<script setup>
import Drawio from '../../components/Drawio.vue'
</script>

该插件提供了一个工具方法，将 draw.io 使用的 `mxgraph` 语法转换成画布的场景图：

```ts
import { parseMxgraphDataToSerializedNodes } from '@infinite-canvas-tutorial/drawio';

const nodes = await parseMxgraphDataToSerializedNodes(
    '<mxGraphModel dx="1422"...',
);
api.runAtNextTick(() => {
    api.updateNodes(nodes);
});
```

<Drawio />
