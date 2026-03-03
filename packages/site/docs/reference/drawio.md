---
outline: deep
---

<script setup>
import Drawio from '../components/Drawio.vue'
</script>

This plugin provides a utility that converts the `mxgraph` format used by draw.io into the canvas scene graph:

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
