---
publish: false
---

<script setup>
import Gradient from '../../components/Gradient.vue'
</script>

我们可以用 [CanvasGradient] API 创建各种渐变效果，然后通过 [Device] API 创建纹理对象，最后将它传给图形的 `fill` 属性完成绘制。

<Gradient />

```ts
// 0. 创建渐变数据
const ramp = generateColorRamp({
    colors: [
        '#FF4818',
        '#F7B74A',
        '#FFF598',
        '#91EABC',
        '#2EA9A1',
        '#206C7C',
    ].reverse(),
    positions: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
});

// 1. 获取画布设备
const device = canvas.getDevice();

// 2. 创建纹理对象
const texture = device.createTexture({
    format: Format.U8_RGBA_NORM,
    width: ramp.width,
    height: ramp.height,
    usage: TextureUsage.SAMPLED,
});
texture.setImageData([ramp.data]);

// 3. 将纹理对象传给图形的 `fill` 属性
rect.fill = { texture };
```

[CanvasGradient]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasGradient
[Device]: /zh/reference/canvas#getdevice
