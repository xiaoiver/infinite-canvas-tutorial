---
publish: false
---

<script setup>
import Iframe from '../components/Iframe.vue'
</script>

Embed YouTube with `<iframe>`:

```ts
const node = {
    id: 'embed-1',
    type: 'embed',
    url: 'https://www.youtube.com/watch?v=37fvFffAmf8',
    x: 100,
    y: 100,
    width: 800,
    height: 450,
    lockAspectRatio: true,
};
```

<Iframe />
