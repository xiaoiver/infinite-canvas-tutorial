---
outline: deep
---

<script setup>
import Mermaid from '../components/Mermaid.vue'
import MermaidRough from '../components/MermaidRough.vue'
import MermaidFlowchart from '../components/MermaidFlowchart.vue'
import MermaidSequence from '../components/MermaidSequence.vue'
import MermaidState from '../components/MermaidState.vue'
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

## flowchart

<Mermaid />

It can also be easily converted into a hand-drawn style:

<MermaidRough />

A more complicated example:

<MermaidFlowchart />

## sequence

<MermaidSequence />

## [WIP] state

<!-- <MermaidState /> -->
