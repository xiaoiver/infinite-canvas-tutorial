# @infinite-canvas-tutorial/mermaid

## Getting started

```ts
import { parseMermaidToSerializedNodes } from '@infinite-canvas-tutorial/mermaid';
const nodes = await parseMermaidToSerializedNodes('flowchart LR\n start-->stop');
api.runAtNextTick(() => {
    api.updateNodes(nodes);
});
```
