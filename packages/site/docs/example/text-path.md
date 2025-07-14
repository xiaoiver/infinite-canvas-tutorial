---
publish: false
---

<script setup>
import TextPath from '../components/TextPath.vue'
</script>

<TextPath />

```ts
const text = new Text({
    x: 0,
    y: 0,
    content: 'Quick brown fox jumps over the lazy dog.',
    fontSize: 15,
    fill: '#F67676',
    fontFamily: 'sans-serif',
    path: 'M10,90 Q90,90 90,45 Q90,10 50,10 Q10,10 10,40 Q10,70 45,70 Q70,70 75,50',
});
```
