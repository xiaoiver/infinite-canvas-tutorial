---
publish: false
---

Use [bidi-js] to handle BiDi.

<script setup>
import Bidi from '../components/Bidi.vue'
</script>

<Bidi />

The following examples are from [What HarfBuzz doesn't do] and [Improving Arabic and Hebrew text in map labels].

```ts
const text = new Text({
    x: 50,
    y: 100,
    content: 'ABCג ב אDEF',
    fontSize: 30,
    fill: '#F67676',
});

const text2 = new Text({
    x: 50,
    y: 150,
    content: 'سلام',
    fontSize: 30,
    fill: '#F67676',
});
```

[bidi-js]: https://github.com/lojjic/bidi-js
[Improving Arabic and Hebrew text in map labels]: https://blog.mapbox.com/improving-arabic-and-hebrew-text-in-map-labels-fd184cf5ebd1
[What HarfBuzz doesn't do]: https://harfbuzz.github.io/what-harfbuzz-doesnt-do.html
