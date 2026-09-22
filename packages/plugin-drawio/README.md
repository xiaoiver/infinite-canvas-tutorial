# @infinite-canvas-tutorial/drawio

## Getting started

```ts
import { parseDrawioToSerializedNodes } from '@infinite-canvas-tutorial/drawio';
const nodes = await parseDrawioToSerializedNodes('xml');
api.runAtNextTick(() => {
    api.updateNodes(nodes);
});
```
