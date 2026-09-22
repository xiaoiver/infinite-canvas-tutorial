# @infinite-canvas-tutorial/vello

## Getting Started

Replace default render pipeline with vello.

```ts
import {
    RendererPlugin,
    DefaultRendererPlugin,
    DefaultPlugins,
} from '@infinite-canvas-tutorial/ecs';
import {
    InitVello,
    VelloPipeline,
    registerFont,
} from '@infinite-canvas-tutorial/vello';

const VelloRendererPlugin = RendererPlugin.configure({
    setupDeviceSystemCtor: InitVello,
    rendererSystemCtor: VelloPipeline,
});
DefaultPlugins.splice(
    DefaultPlugins.indexOf(DefaultRendererPlugin),
    1,
    VelloRendererPlugin,
);

registerFont('/Gaegu-Regular.ttf');
registerFont('/NotoSansCJKsc-VF.ttf');

new App().addPlugins(...DefaultPlugins, UIPlugin).run();
```
