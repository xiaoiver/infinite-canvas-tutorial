---
outline: deep
---

<script setup>
import LaserPointer from '../components/LaserPointer.vue'
</script>

Add this plugin with configuration (similar to tiptap's plugin system):

```ts
import { App, DefaultPlugins } from '@infinite-canvas-tutorial/ecs';
import { UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { EraserPlugin } from '@infinite-canvas-tutorial/eraser';

new App().addPlugins(...DefaultPlugins, UIPlugin, LaserPointerPlugin).run();
```

Then import the Spectrum UI like this:

```ts
import '@infinite-canvas-tutorial/laser-pointer/spectrum';
```

And declare this penbar item in HTML like this:

```html
<ic-spectrum-canvas>
    <ic-spectrum-penbar-laser-pointer slot="penbar-item"><ic-spectrum-penbar-laser-pointer />
</ic-spectrum-canvas>
```

The configuration as follows:

```ts
api.setAppState({
    laserPointerColor: 'red',
    laserPointerSize: 2,
});
```

<LaserPointer />
