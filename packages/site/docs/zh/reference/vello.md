---
outline: deep
---
<script setup>
import Vello from '../../components/Vello.vue'
</script>

使用基于瓦片和 GPU compute shader 的渲染器 [vello]，详见：[课程 35 - 基于瓦片的渲染]

<Vello />

```ts
import {
    DefaultPlugins,
    DefaultRendererPlugin,
    RendererPlugin,
} from '@infinite-canvas-tutorial/ecs';
import {
    InitVello,
    VelloPipeline,
    registerFont,
} from '@infinite-canvas-tutorial/plugin-vello';

const VelloRendererPlugin = RendererPlugin.configure({
    setupDeviceSystemCtor: InitVello,
    rendererSystemCtor: VelloPipeline,
});
DefaultPlugins.splice(
    DefaultPlugins.indexOf(DefaultRendererPlugin),
    1,
    VelloRendererPlugin,
);
registerFont('/NotoSansCJKsc-VF.ttf');
registerFont('/Gaegu-Regular.ttf');
```

[vello]: https://github.com/linebender/vello
[课程 35 - 基于瓦片的渲染]: /zh/guide/lesson-035
