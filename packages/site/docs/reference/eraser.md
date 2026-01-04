---
outline: deep
---

<script setup>
import Eraser from '../components/Eraser.vue'
</script>

Add this plugin with configuration (similar to tiptap's plugin system):

```ts
import { App, DefaultPlugins } from '@infinite-canvas-tutorial/ecs';
import { UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { EraserPlugin } from '@infinite-canvas-tutorial/eraser';

const app = new App().addPlugins(...DefaultPlugins, UIPlugin, EraserPlugin);
app.run();
```

Then import the Spectrum UI like this:

```ts
import '@infinite-canvas-tutorial/eraser/spectrum';
```

And declare this penbar item in HTML like this:

```html
<ic-spectrum-canvas>
    <ic-spectrum-penbar-eraser slot="penbar-item"><ic-spectrum-penbar-eraser />
</ic-spectrum-canvas>
```

<Eraser />
