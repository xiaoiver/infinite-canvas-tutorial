---
outline: deep
---

<script setup>
import Lasso from '../components/Lasso.vue'
</script>

```ts
import { App, DefaultPlugins } from '@infinite-canvas-tutorial/ecs';
import { UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { LassoPlugin } from '@infinite-canvas-tutorial/lasso';

const app = new App().addPlugins(...DefaultPlugins, UIPlugin, LassoPlugin);
app.run();
```

Then import the Spectrum UI like this:

```ts
import '@infinite-canvas-tutorial/lasso/spectrum';
```

And declare this penbar item in HTML like this:

```html
<ic-spectrum-canvas>
    <ic-spectrum-penbar-lasso slot="penbar-item"><ic-spectrum-penbar-lasso />
</ic-spectrum-canvas>
```

Supports the following configuration items:

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
