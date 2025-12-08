# @infinite-canvas-tutorial/sam

```ts
import { App, DefaultPlugins } from '@infinite-canvas-tutorial/ecs';
import { UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { SAMPlugin } from '@infinite-canvas-tutorial/sam';

const app = new App().addPlugins(...DefaultPlugins, UIPlugin, SAMPlugin);
app.run();
```
