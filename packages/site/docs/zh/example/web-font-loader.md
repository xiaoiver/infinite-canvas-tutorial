---
title: "Web 字体加载与绘制时机"
description: "在首帧绘制前协调字体就绪，避免闪烁与回退字体跳变。"
---
<!-- example-intro:zh -->

# Web 字体加载与绘制时机

画布上的 FOIT/FOUT 与 DOM 类似，应使用 **WebFontLoader** 或 `document.fonts` 控制首次绘制时机，见 [第 15 课](/zh/guide/lesson-015)。

协同场景可对关键字体做预加载，减轻布局跳动。

## 交互示例

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
