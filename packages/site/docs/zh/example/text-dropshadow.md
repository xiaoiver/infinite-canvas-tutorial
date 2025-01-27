---
publish: false
---

<script setup>
import TextDropshadow from '../../components/TextDropshadow.vue'
</script>

在 SDF 纹理采样时使用偏移量实现阴影效果，可以参考：[Pixi.js DropShadow Filter]

<TextDropshadow />

```ts
const text = new Text({
    x: 50,
    y: 100,
    content: 'Hello, world!',
    fontSize: 30,
    fill: '#F67676',
    dropShadowColor: '#000000',
    dropShadowOffsetX: 2,
    dropShadowOffsetY: 2,
    dropShadowBlurRadius: 10,
});
```

[Pixi.js DropShadow Filter]: https://github.com/pixijs/filters/blob/main/src/drop-shadow/drop-shadow.frag#L13
