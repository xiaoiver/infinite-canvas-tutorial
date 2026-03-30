---
outline: deep
---

<script setup>
import Mermaid from '../../components/Mermaid.vue'
import MermaidRough from '../../components/MermaidRough.vue'
import MermaidFlowchart from '../../components/MermaidFlowchart.vue'
import MermaidFlowchartWatercolor from '../../components/MermaidFlowchartWatercolor.vue'
import MermaidSequence from '../../components/MermaidSequence.vue'
import MermaidState from '../../components/MermaidState.vue'
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

## flowchart

<Mermaid />

也可以很容易地转换成手绘风格：

<MermaidRough />

一个稍微复杂一点的例子：

<MermaidFlowchart />

水彩风格：

<MermaidFlowchartWatercolor />

## sequence

<MermaidSequence />

## [WIP] state

<!-- <MermaidState /> -->
