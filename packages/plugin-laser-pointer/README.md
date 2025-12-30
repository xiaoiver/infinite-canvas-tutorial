# @infinite-canvas-tutorial/laser-pointer

## Getting started

Add this plugin with configuration (similar to tiptap's plugin system):

```ts
import { App, DefaultPlugins } from '@infinite-canvas-tutorial/ecs';
import { UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { LaserPointerPlugin } from '@infinite-canvas-tutorial/laser-pointer';

const app = new App().addPlugins(
    ...DefaultPlugins,
    UIPlugin,
    LaserPointerPlugin,
);
app.run();
```
