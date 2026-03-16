---
outline: deep
---

<script setup>
import Vello from '../components/Vello.vue'
</script>

Use tile-based render [vello] with GPU compute shader, see: [Lesson 35 - Tile-based Rendering]

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
[Lesson 35 - Tile-based Rendering]: /guide/lesson-035
