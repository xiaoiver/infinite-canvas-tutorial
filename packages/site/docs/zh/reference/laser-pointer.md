---
outline: deep
---

<script setup>
import LaserPointer from '../../components/LaserPointer.vue'
</script>

首先注册插件：

```ts
import { LaserPointerPlugin } from '@infinite-canvas-tutorial/laser-pointer';

new App().addPlugins(...DefaultPlugins, UIPlugin, LaserPointerPlugin).run();
```

然后引入 Spectrum UI：

```ts
import '@infinite-canvas-tutorial/laser-pointer/spectrum';
```

最后在 HTML 中通过 slot 使用组件:

```html
<ic-spectrum-canvas>
    <ic-spectrum-penbar-laser-pointer slot="penbar-item"><ic-spectrum-penbar-laser-pointer />
</ic-spectrum-canvas>
```

支持以下配置项：

```ts
api.setAppState({
    laserPointerColor: 'red',
    laserPointerSize: 2,
});
```

<LaserPointer />
