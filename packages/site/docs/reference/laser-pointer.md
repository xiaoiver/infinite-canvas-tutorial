---
outline: deep
---

<script setup>
import LaserPointer from '../components/LaserPointer.vue'
</script>

```ts
import { LaserPointerPlugin } from '@infinite-canvas-tutorial/laser-pointer';

new App().addPlugins(...DefaultPlugins, UIPlugin, LaserPointerPlugin).run();
```

```ts
api.setAppState({
    laserPointerColor: 'red',
    laserPointerSize: 2,
});
```

<LaserPointer />
