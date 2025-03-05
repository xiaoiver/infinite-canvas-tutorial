---
publish: false
---

<a href="/guide/lesson-015">Draw text</a>

<script setup>
import Emoji from '../../components/Emoji.vue'
</script>

<Emoji />

```ts
const text = new Text({
    x: 50,
    y: 100,
    content: 'Hello, world! \n🌹🌍🌞🌛',
    fontSize: 30,
    fill: '#F67676',
});
```
