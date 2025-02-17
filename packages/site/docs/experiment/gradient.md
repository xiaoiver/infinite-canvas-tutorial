---
publish: false
---

<script setup>
import Gradient from '../components/Gradient.vue'
</script>

We can use [CanvasGradient] API to create various gradient effects, and then use [Device] API to create a texture object, and finally pass it to the `fill` property of the graphic to complete the drawing.

<Gradient />

```ts
// 0. Create gradient data
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

// 1. Get canvas device
const device = canvas.getDevice();

// 2. Create texture object
const texture = device.createTexture({
    format: Format.U8_RGBA_NORM,
    width: ramp.width,
    height: ramp.height,
    usage: TextureUsage.SAMPLED,
});
texture.setImageData([ramp.data]);

// 3. Pass the texture object to the `fill` property of the graphic
rect.fill = texture;
```

[CanvasGradient]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasGradient
[Device]: /reference/canvas#getdevice
