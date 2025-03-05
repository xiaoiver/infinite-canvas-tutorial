---
publish: false
---

<script setup>
import WebFontLoader from '../../components/WebFontLoader.vue'
</script>

<WebFontLoader />

```ts
import WebFont from 'webfontloader';

WebFont.load({
    google: {
        families: ['Gaegu'],
    },
    active: () => {
        const text = new Text({
            x: 150,
            y: 150,
            content: 'Hello, world',
            fontFamily: 'Gaegu',
            fontSize: 55,
            fill: '#F67676',
        });
        canvas.appendChild(text);
    },
});
```
