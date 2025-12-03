---
publish: false
---

<script setup>
import ImageProcessing from '../../components/ImageProcessing.vue'
</script>

```ts
const node = {
    id: '1',
    type: 'rect',
    fill: 'https://v3b.fal.media/files/b/tiger/v1lf1EcPP1X1pw_YOKM4o.jpg',
    x: 50,
    y: 50,
    width: 200,
    height: 200,
    lockAspectRatio: true,
    filter: 'noise(0.6)',
};
```

<ImageProcessing />
