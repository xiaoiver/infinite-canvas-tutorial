---
publish: false
---

<script setup>
import Harfbuzz from '../../components/Harfbuzz.vue'
</script>

[使用 Harfbuzz.js 进行 Shaping](/zh/guide/lesson-016#harfbuzzjs)

<Harfbuzz />

首先初始化 harfbuzzjs WASM，这里使用 Vite 的 `?init` 语法。然后加载字体文件，并创建 `font` 对象。

```ts
import init from 'harfbuzzjs/hb.wasm?init';
import hbjs from 'harfbuzzjs/hbjs.js';

const instance = await init();
hb = hbjs(instance);

const data = await (
    await window.fetch('/fonts/NotoSans-Regular.ttf')
).arrayBuffer();
blob = hb.createBlob(data);
face = hb.createFace(blob, 0);
font = hb.createFont(face);
font.setScale(32, 32); // 设置字体大小
```

然后创建一个 `buffer` 对象，并添加文本内容。我们之前提过 harfbuzz 并不处理 BiDi，因此这里需要手动设置文本方向。最后调用 `hb.shape` 方法进行 Shaping 计算。

```ts
buffer = hb.createBuffer();
buffer.addText('H');
buffer.guessSegmentProperties();
// TODO: use BiDi
// buffer.setDirection(segment.direction);

hb.shape(font, buffer);
const result = buffer.json(font);
```

此时我们就得到字形数据了，随后可以使用 Path 绘制

```ts
result.forEach(function (x) {
    const d = font.glyphToPath(x.g);
    const path = new Path({
        d,
        fill: '#F67676',
    });
});
```
