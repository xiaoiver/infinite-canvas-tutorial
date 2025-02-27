---
outline: deep
publish: false
---

<script setup>
import Gradient from '../../components/Gradient.vue';
import MeshGradient from '../../components/MeshGradient.vue';
import DeclarativeGradient from '../../components/DeclarativeGradient.vue';
import Pattern from '../../components/Pattern.vue';
import Voronoi from '../../components/Voronoi.vue';
import FractalBrownianMotion from '../../components/FractalBrownianMotion.vue';
import DomainWarping from '../../components/DomainWarping.vue';
</script>

# 课程 18 - 渐变和重复图案

在本节课中我们将介绍如何实现渐变和重复图案，包含以下内容：

-   使用 CanvasGradient 实现渐变
    -   命令式。使用 Device API 创建纹理
    -   声明式。支持 CSS 渐变语法：`linear-gradient`、`radial-gradient`、`conic-gradient`
    -   使用 Shoelace 实现渐变配置面板
-   使用 Shader 实现 Mesh 渐变
    -   模拟随机
    -   Value Noise 和 Gradient Noise
    -   Voronoi、FBM 和 Domain Warping
-   导出 SVG
-   使用 CanvasPattern 实现重复图案

## 使用 CanvasGradient 实现渐变 {#canvas-gradient}

我们可以用 [CanvasGradient] API 创建各种渐变效果，随后以纹理的形式消费。下面我们将介绍命令式和声明式的两种实现。

### 命令式创建渐变纹理 {#create-gradient-texture}

以线性渐变为例，创建 `<canvas>` 并得到上下文后，使用 [createLinearGradient] 时需要传入起点和终点，两者定义了渐变的方向。随后添加多个色标，绘制到 `<canvas>` 上，后续作为创建纹理的来源：

```ts
const gradient = ctx.createLinearGradient(0, 0, 1, 0); // x1, y1, x2, y2

gradient.addColorStop(0, 'red');
gradient.addColorStop(1, 'blue');

ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 256, 1);
```

通过 [Device] API 创建纹理对象，最后将它传给图形的 `fill` 属性完成绘制。

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
texture.setImageData([ramp.data]); // 将之前创建的 <canvas> 数据传给纹理

// 3. 将纹理对象传给图形的 `fill` 属性
rect.fill = texture;
```

<Gradient />

但我们希望支持声明式语法，提升易用性的同时也便于序列化。

### 声明式 CSS 渐变语法 {#css-gradient-syntax}

参考 CSS 的渐变语法，我们可以使用 [gradient-parser] 解析得到结构化的结果，后续用来调用 [createLinearGradient] 等 API：

```ts
rect.fill = 'linear-gradient(0deg, blue, green 40%, red)';
rect.fill = 'radial-gradient(circle at center, red, blue, green 100%)';
```

解析结果如下：

```js eval code=false
linearGradient = call(() => {
    const { parseGradient } = Core;
    return parseGradient('linear-gradient(0deg, blue, green 40%, red)');
});
```

```js eval code=false
radialGradient = call(() => {
    const { parseGradient } = Core;
    return parseGradient(
        'radial-gradient(circle at center, red, blue, green 100%)',
    );
});
```

常见的渐变类型有以下几种，我们暂时支持前三种：

-   [linear-gradient] CSS 和 Canvas 支持
-   [radial-gradient] CSS 和 Canvas 支持
-   [conic-gradient] CSS 和 Canvas 支持
-   [repeating-linear-gradient] CSS 支持，使用 Canvas 也可以 hack 实现，详见 [How to make a repeating CanvasGradient]
-   [repeating-radial-gradient] CSS 支持
-   [sweep-gradient] CanvasKit / Skia 中支持

<DeclarativeGradient />

另外我们支持叠加多个渐变，例如：

```ts
rect.fill = `linear-gradient(217deg, rgba(255,0,0,.8), rgba(255,0,0,0) 70.71%),
    linear-gradient(127deg, rgba(0,255,0,.8), rgba(0,255,0,0) 70.71%),
    linear-gradient(336deg, rgba(0,0,255,.8), rgba(0,0,255,0) 70.71%)`;
```

### 渐变编辑面板 {#gradient-editor}

参考 Figma 的渐变编辑面板，我们也实现了一套类似的编辑器，你可以在上面的例子中选中图形后触发编辑面板。

![Figma gradient panel](/figma-gradient-panel.png)

## 使用 Mesh 实现渐变 {#mesh-gradient}

以上基于 Canvas 和 SVG 实现的渐变表现力有限，无法展示复杂的效果。一些设计工具例如 Sketch / Figma 社区中有很多基于 Mesh 的实现，例如：

-   [Mesh gradients plugin for Sketch]
-   [Mesh Gradient plugin for Figma]
-   [Photo gradient plugin for Figma]

我们参考一些开源的实现，有的是在 Vertex Shader 中实现，有的是在 Fragment Shader 中实现，我们选择后者：

-   [meshgradient]
-   [Mesh gradient generator]
-   [react-mesh-gradient]

<MeshGradient />

由于需要兼顾 WebGL1 的 GLSL100 语法，需要避免使用 `switch`，否则会得到类似的报错：

> [!CAUTION]
> ERROR: 0:78: 'switch' : Illegal use of reserved word

另外在 `for` 循环中也无法将 Uniform 当作 `index` 的终止条件：

> [!CAUTION]
> ERROR: 0:87: 'i' : Loop index cannot be compared with non-constant expression

因此我们只能使用类似 Three.js chunks 中处理光源的代码，用常量 `MAX_POINTS` 来限制循环次数：

```glsl
#define MAX_POINTS 10

for (int i = 0; i < MAX_POINTS; i++) {
    if (i < int(u_PointsNum)) {
        // ...
    }
}
```

下面我们来详细介绍下 Shader 中的细节。可以参考 [The book of shaders - 生成设计] 了解更多细节。

### 模拟随机 {#random}

为了实现噪声效果，肯定需要用随机函数。而 GLSL 中并没有类似 `random` 这样的内置函数，这就需要我们模拟这种随机的行为。 由于是模拟的，对于同一个 `random(x)` 总是得到同样的返回值，因此这是一种伪随机。

如果我们想得到一个取值范围在 0-1 之间的 `random` 函数，可以使用 `y = fract(sin(x)*1.0);`，只保留小数部分。

![y = fract(sin(x)*1.0)](https://xiaoiver.github.io/assets/img/resized/480/tbs-rand1.png)

观察这个函数可以发现，如果我们能将周期缩小到极短，对于同一个 x 对应的取值就可以认为是近似随机（伪随机）的。 具体方式就是增大系数，例如 `y = fract(sin(x)*10.0);`。

![y = fract(sin(x)*10.0)](https://xiaoiver.github.io/assets/img/resized/480/tbs-rand2.png)

进一步增加到 100000，我们已经无法分辨出 `sin` 的波形了。 再次需要明确一点，不同于 JS 中的 `Math.random()`，这种方式只是确定性随机，本质其实是一个 Hash 函数。

我们需要将 `random` 应用到 2D 场景中，输入从单一的 x 变成了 xy 坐标，需要将二维向量映射成一个单一值。the book of shaders 使用了 `dot` 内置函数点乘了一个特定的向量，但是并没有解释原因。

```glsl
float random (vec2 st) {
    return fract(sin(
        dot(st.xy,vec2(12.9898,78.233)))*
        43758.5453123);
}
```

在网上搜索一番后，找到了这个回答 [What's the origin of this GLSL rand() one-liner?]。大概是说最早来自一篇论文，也没有解释选择这三个 Magic Number 的理由。总之生成的效果是很好的，类似黑白电视机的“雪花屏”。可以在上面的例子中将 `NoiseRatio` 调大看到这个效果。

### Value Noise {#value-noise}

使用我们定义的 `random` 函数，结合 `floor` 可以得到阶梯状的函数。

```glsl
float i = floor(x);
y = random(i);
```

![step](https://xiaoiver.github.io/assets/img/webgl/tbs-noise1.png)

如果我们想对相邻“阶梯”间进行插值，可以使用线性函数或者平滑的插值函数 `smoothstep`：

```glsl
float i = floor(x);
float f = fract(x);
y = mix(rand(i), rand(i + 1.0), f);
// y = mix(rand(i), rand(i + 1.0), smoothstep(0.,1.,f));
```

![smoothstep](https://xiaoiver.github.io/assets/img/webgl/tbs-noise2.png)

在一维中插值我们选取了 `i+1`，在二维中进行插值可以选取相邻的 4 个点。相应的混合函数也需要进行修改。原文中混合函数是展开后的形式，有点难看懂，但是好处是少调用了两次 `mix`。

```glsl
float noise (in vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    // Four corners in 2D of a tile
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    vec2 u = smoothstep(0.,1.,f);

    // Mix 4 coorners percentages
    return mix(a, b, u.x) +
            (c - a)* u.y * (1.0 - u.x) +
            (d - b) * u.x * u.y;

    // 其实是下面的展开形式
    return mix( mix( a, b , u.x),
                mix( c, d, u.x), u.y);
}
```

以上生成噪声的方法，都是在随机值之间进行插值，因此被称为 “value noise”。仔细观察可以发现这种方式生成的结以上生成噪声的方法，都是在随机值之间进行插值，因此被称为 value noise。仔细观察可以发现这种方式生成的结果有明显的块状痕迹，例如下面例子中左侧部分。

<iframe width="640" height="360" frameborder="0" src="https://www.shadertoy.com/embed/lsf3WH?gui=true&t=10&paused=true&muted=false" allowfullscreen></iframe>

### Gradient Noise {#gradient-noise}

> 在 1985 年 Ken Perlin 开发了另一种 noise 算法 Gradient Noise。Ken 解决了如何插入随机的 gradients（梯度、渐变）而不是一个固定值。这些梯度值来自于一个二维的随机函数，返回一个方向（vec2 格式的向量），而不仅是一个值（float 格式）。

具体算法如下，可以看出和 value noise 最大的区别就是使用了 `dot` 对四个方向的向量进行插值：

```glsl
float noise( in vec2 st ) {
    vec2 i = floor(st);
    vec2 f = fract(st);

 vec2 u = smoothstep(0., 1., f);

    return mix( mix( dot( random( i + vec2(0.0,0.0) ), f - vec2(0.0,0.0) ),
                     dot( random( i + vec2(1.0,0.0) ), f - vec2(1.0,0.0) ), u.x),
                mix( dot( random( i + vec2(0.0,1.0) ), f - vec2(0.0,1.0) ),
                     dot( random( i + vec2(1.0,1.0) ), f - vec2(1.0,1.0) ), u.x), u.y);
}
```

> 对于 Ken Perlin 来说他的算法所取得的成功是远远不够的。他觉得可以更好。在 2001 年的 Siggraph 上，他展示了 “simplex noise”

具体实现可以参考：[2d-snoise-clear]，也有 3D 版本。

### Voronoi {#voronoi}

之前我们在「绘制 Pattern」中已经学到了如何划分空间到一个个小的网格区域。我们可以为每个网格生成一个随机的特征点，对于某一个网格内的 fragment，只需要计算与他所在网格相邻的 8 个网格中特征点的最小距离，这就大大减少了运算量。这就是 Steven Worley 的论文中的主要思想。

生成随机特征点使用了之前学过的 random 方法，由于是确定性随机，每个网格内的特征点是固定的。

```glsl
// 划分网格
vec2 i_st = floor(st);
vec2 f_st = fract(st);
float m_dist = 1.;
// 8 个方向
for (int y= -1; y <= 1; y++) {
    for (int x= -1; x <= 1; x++) {
        // 当前相邻的网格
        vec2 neighbor = vec2(float(x),float(y));
        // 相邻网格中的特征点
        vec2 point = random2(i_st + neighbor);
        // fragment 到特征点的距离
        vec2 diff = neighbor + point - f_st;
        float dist = length(diff);
        // 保存最小值
        m_dist = min(m_dist, dist);
    }
}
color += m_dist;
```

<Voronoi />

### FBM {#fbm}

> 通过在循环（循环次数为 octaves，一次循环为一个八度）中叠加噪声，并以一定的倍数（lacunarity，间隙度）连续升高频率，同时以一定的比例（gain，增益）降低 噪声 的振幅，最终的结果会有更好的细节。这项技术叫“分形布朗运动（fractal Brownian Motion）”（fBM），或者“分形噪声（fractal noise）”

```glsl
const int octaves = 6;
float lacunarity = 2.0;
float gain = 0.5;

float amplitude = 0.5;
float frequency = 1.;

for (int i = 0; i < octaves; i++) {
 y += amplitude * noise(frequency*x);
 frequency *= lacunarity;
 amplitude *= gain;
}
```

<FractalBrownianMotion />

### Domain Warping {#domain-warping}

大致思想是递归调用 `fbm`：

```glsl
f(p) = fbm( p + fbm( p + fbm( p ) ) )
```

-   [Inigo Quilez's Domain Warping]
-   [Mike Bostock's Domain Warping]

<DomainWarping />

## 导出渐变成 SVG {#export-gradient-to-svg}

### 线性渐变 {#linear-gradient}

SVG 提供了 [linearGradient] 和 [radialGradient]，但支持的属性和 [CanvasGradient] 很不一样。

### 圆锥渐变 {#conic-gradient}

参考 [SVG angular gradient] 可以近似实现这种效果。而 [CSS conic-gradient() polyfill] 的思路是使用 Canvas 渲染后导出 dataURL，再用 `<image>` 引用。

### 多个渐变叠加 {#multiple-gradient-overlay}

对于多个渐变叠加的情况，在 Canvas API 可以多次设置 `fillStyle` 叠加绘制。而在声明式的 SVG 中，可以使用多个 `<feBlend>` 实现。

## 实现重复图案 {#pattern}

我们可以使用 Canvas API 提供的 [createPattern] 创建，支持如下语法：

```ts
export interface Pattern {
    image: string | CanvasImageSource;
    repetition?: 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat';
    transform?: string;
}

rect.fill = {
    image,
    repetition: 'repeat',
};
```

其中字符串形式的 `transform` 需要解析成 `mat3`，后续才能传递给 [setTransform]。

<Pattern />

[CanvasGradient]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasGradient
[Device]: /zh/reference/canvas#getdevice
[linear-gradient]: https://developer.mozilla.org/zh-CN/docs/Web/CSS/gradient/linear-gradient
[radial-gradient]: https://developer.mozilla.org/zh-CN/docs/Web/CSS/gradient/radial-gradient
[repeating-linear-gradient]: https://developer.mozilla.org/zh-CN/docs/Web/CSS/gradient/repeating-linear-gradient
[repeating-radial-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/repeating-radial-gradient
[conic-gradient]: https://developer.mozilla.org/zh-CN/docs/Web/CSS/gradient/conic-gradient
[sweep-gradient]: https://stackoverflow.com/questions/44912075/sweep-gradient-what-it-is-and-its-examples
[gradient-parser]: https://github.com/rafaelcaricio/gradient-parser
[Mesh gradients plugin for Sketch]: https://www.meshgradients.com/
[Mesh Gradient plugin for Figma]: https://www.figma.com/community/plugin/958202093377483021/mesh-gradient
[Photo gradient plugin for Figma]: https://www.figma.com/community/plugin/1438020299097238961/photo-gradient
[meshgradient]: https://meshgradient.com/
[Mesh gradient generator]: https://kevingrajeda.github.io/meshGradient/
[react-mesh-gradient]: https://github.com/JohnnyLeek1/React-Mesh-Gradient
[Inigo Quilez's Domain Warping]: https://iquilezles.org/articles/warp/
[Mike Bostock's Domain Warping]: https://observablehq.com/@mbostock/domain-warping
[linearGradient]: https://developer.mozilla.org/zh-CN/docs/Web/SVG/Element/linearGradient
[radialGradient]: https://developer.mozilla.org/zh-CN/docs/Web/SVG/Element/radialGradient
[createLinearGradient]: https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/createLinearGradient
[SVG angular gradient]: https://stackoverflow.com/questions/2465405/svg-angular-gradient
[How to make a repeating CanvasGradient]: https://stackoverflow.com/questions/56398519/how-to-make-a-repeating-canvasgradient
[CSS conic-gradient() polyfill]: https://projects.verou.me/conic-gradient/
[createPattern]: https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/createPattern
[setTransform]: https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasPattern/setTransform
[What's the origin of this GLSL rand() one-liner?]: https://stackoverflow.com/questions/12964279/whats-the-origin-of-this-glsl-rand-one-liner
[The book of shaders - 生成设计]: https://thebookofshaders.com/10/
[2d-snoise-clear]: https://thebookofshaders.com/edit.php#11/2d-snoise-clear.frag
