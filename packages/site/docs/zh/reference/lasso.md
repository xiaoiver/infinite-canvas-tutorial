---
outline: deep
---

<script setup>
import Lasso from '../../components/Lasso.vue'
</script>

首先注册插件：

```ts
import { App, DefaultPlugins } from '@infinite-canvas-tutorial/ecs';
import { UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { LassoPlugin } from '@infinite-canvas-tutorial/lasso';

const app = new App().addPlugins(...DefaultPlugins, UIPlugin, LassoPlugin);
app.run();
```

然后引入 Spectrum UI：

```ts
import '@infinite-canvas-tutorial/lasso/spectrum';
```

最后在 HTML 中通过 `<slot>` 使用组件：

```html
<ic-spectrum-canvas>
    <ic-spectrum-lasso slot="penbar-item"><ic-spectrum-lasso />
</ic-spectrum-canvas>
```

支持以下配置项：

```ts
interface AppState {
    lassoTrailStroke: string;
    lassoTrailFill: string;
    lassoTrailFillOpacity: number;
    lassoTrailStrokeDasharray: string;
    lassoTrailStrokeDashoffset: string;
}
```

<Lasso />
