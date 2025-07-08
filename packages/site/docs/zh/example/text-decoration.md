---
publish: false
---

<script setup>
import TextDecoration from '../../components/TextDecoration.vue'
</script>

实现类似 CSS [text-decoration] 效果。

<TextDecoration />

```ts
const text = new Text({
    x: 50,
    y: 100,
    content: "I'd far rather be\nhappy than right any day.",
    fontSize: 45,
    fill: '#F67676',
    decorationColor: 'black',
    decorationLine: 'underline',
    decorationStyle: 'wavy',
    decorationThickness: 10,
});
```

[text-decoration]: https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration
