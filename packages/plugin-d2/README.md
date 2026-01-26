# @infinite-canvas-tutorial/d2

## Getting started

```ts
import { parseD2ToSerializedNodes } from '@infinite-canvas-tutorial/d2';

const nodes = await parseD2ToSerializedNodes('x -> y: hello world');
api.runAtNextTick(() => {
    api.updateNodes(nodes);
});
```
