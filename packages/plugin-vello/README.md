# @infinite-canvas-tutorial/vello

## Getting Started

Replace default render pipeline with vello.

```ts
import {
    RendererPlugin,
    DefaultRendererPlugin,
    DefaultPlugins,
} from '@infinite-canvas-tutorial/ecs';
import { VelloPipeline } from '@infinite-canvas-tutorial/vello';

const VelloRendererPlugin = RendererPlugin.configure({
    rendererSystemCtor: VelloPipeline,
});
DefaultPlugins.splice(
    DefaultPlugins.indexOf(DefaultRendererPlugin),
    1,
    VelloRendererPlugin,
);

new App().addPlugins(...DefaultPlugins, UIPlugin).run();
```
