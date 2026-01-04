---
outline: deep
---

<script setup>
import Eraser from '../../components/Eraser.vue'
</script>

首先注册插件：

```ts
import { EraserPlugin } from '@infinite-canvas-tutorial/eraser';

new App().addPlugins(...DefaultPlugins, UIPlugin, EraserPlugin).run();
```

然后引入 Spectrum UI：

```ts
import '@infinite-canvas-tutorial/eraser/spectrum';
```

最后在 HTML 中通过 slot 使用组件:

```html
<ic-spectrum-canvas>
    <ic-spectrum-penbar-eraser slot="penbar-item"><ic-spectrum-penbar-eraser />
</ic-spectrum-canvas>
```

<Eraser />
