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
import MermaidERD from '../../components/MermaidERD.vue'
import MermaidClass from '../../components/MermaidClass.vue'
import MermaidMindmap from '../../components/MermaidMindmap.vue'
</script>

该插件提供了一个工具方法，将 Mermaid 语法转换成画布的场景图，详见：[课程 32 - 文本生成图表]

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

### rough

也可以很容易地转换成手绘风格：

<MermaidRough />

一个稍微复杂一点的例子：

<MermaidFlowchart />

### watercolor

基于 [watercolorizer] 实现的水彩风格：

<MermaidFlowchartWatercolor />

## sequence

<MermaidSequence />

## state

<MermaidState />

## ERD

<MermaidERD />

## Class

<MermaidClass />

## Mindmap

[课程 23 - 思维导图]

<MermaidMindmap />

[课程 32 - 文本生成图表]: /zh/guide/lesson-032
[课程 23 - 思维导图]: /zh/guide/lesson-023
[watercolorizer]: https://github.com/32bitkid/watercolorizer
