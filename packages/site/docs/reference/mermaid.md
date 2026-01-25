---
outline: deep
---

<script setup>
import Mermaid from '../components/Mermaid.vue'
import MermaidRough from '../components/MermaidRough.vue'
</script>

This plugin provides a utility method that converts Mermaid syntax into a scene graph for the canvas:

```ts
import { parseMermaidToSerializedNodes } from '@infinite-canvas-tutorial/mermaid';

const nodes = await parseMermaidToSerializedNodes(
    'flowchart LR\n start-->stop',
);
api.runAtNextTick(() => {
    api.updateNodes(nodes);
});
```

Currently only supports simple `flowchart`

<Mermaid />

It can also be easily converted into a hand-drawn style:

<MermaidRough />
