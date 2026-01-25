# @infinite-canvas-tutorial/mermaid

<https://docs.excalidraw.com/docs/@excalidraw/mermaid-to-excalidraw/codebase/parser/>

## Getting started

Add this plugin with configuration (similar to tiptap's plugin system):

```ts
import { App, DefaultPlugins } from '@infinite-canvas-tutorial/ecs';
import { UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { MermaidPlugin } from '@infinite-canvas-tutorial/mermaid';

const app = new App().addPlugins(...DefaultPlugins, UIPlugin, MermaidPlugin);
app.run();
```
