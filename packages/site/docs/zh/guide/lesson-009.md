---
outline: deep
---

# 课程 9 - 绘制椭圆和矩形

在 [课程 2] 中我们使用 SDF 绘制了圆形，很容易将它扩展到椭圆和矩形。[2D distance functions] 提供了更多 2D 图形的 SDF 表达：

```glsl
float sdf_ellipse(vec2 p, vec2 r) {}
float sdf_rounded_box(vec2 p, vec2 b, vec4 r) {}
```

在 Shader 中使用 `shape` 变量区分这三种图形，这样我们就可以用同一组 Shader 绘制它们了：

```glsl
if (shape < 0.5) {
  outerDistance = sdf_circle(v_FragCoord, 1.0);
  innerDistance = sdf_circle(v_FragCoord, r.x);
} else if (shape < 1.5) {
  outerDistance = sdf_ellipse(v_FragCoord, vec2(wh, 1.0));
  innerDistance = sdf_ellipse(v_FragCoord, r);
} else if (shape < 2.5) {
  outerDistance = sdf_rounded_box(v_FragCoord, vec2(wh, 1.0), 0.0);
  innerDistance = sdf_rounded_box(v_FragCoord, r, 0.0);
}
```

下面我们来看 SDF 是如何推导的。

## 圆角矩形

[The SDF of a Box] 和 [Leveraging Rust and the GPU to render user interfaces at 120 FPS] 分别以视频和动画的形式对它的推导过程进行了展示。

基于矩形的对称性，将它的中心放置在原点后，我们可以通过 `abs()` 函数将任意点到矩形边缘距离的问题转换到第一象限：

![rect SDF abs function](/rect-sdf-abs.png)

随后

![rect SDF](/rect-sdf-dist.png)

### 增加阴影

-   [Blurred rounded rectangles]
-   [Leveraging Rust and the GPU to render user interfaces at 120 FPS]
-   [Shape Lens Blur Effect with SDFs and WebGL]

## 椭圆 {#ellipse}

不同于判断任意点到圆上的最近距离，针对椭圆的精确分析方法要复杂得多，[Distance to an ellipse] 给出了两种方法：一元四次方程和 Newton 方法。

### 求解一元四次方程 {#quartic-equation}

椭圆使用 $q(\omega) = \{ a⋅cos \omega, b⋅sin \omega \}$ 表示，任意点 $p$ 到椭圆上点的距离平方为：

$$ s^2(\omega) = \left| q(\omega) - p \right|^2 $$

展开后：

$$ a^2cos^2\omega + b^2sin^2\omega + x^2 + y^2 - 2(axcos \omega - bysin \omega) $$

对 $\omega$ 求导得到：

$$ −2a^2sin\omega ⋅cos\omega + 2b^2cos\omega ⋅sin\omega + 2axsin\omega − 2bycos\omega $$

最近点导数为 0，将 $\lambda=cos\omega$ 带入得到：

$$ \sqrt{1-\lambda^{2}}\left(\left(b^{2}-a^{2}\right) \lambda+a x\right)=b y \lambda $$

这是一个关于 $\lambda$ 的一元四次方程，各项系数为：

$$
\displaylines{
  a_4=\left(b^{2}-a^{2}\right)^{2} \\
  a_3=2 a x\left(b^{2}-a^{2}\right) \\
  a_2=\left(a^{2} x^{2}+b^{2} y^{2}\right)-\left(b^{2}-a^{2}\right)^{2} \\
  a_1=-2 a x\left(b^{2}-a^{2}\right) \\
  a_0=-a^{2} x^{2}
}
$$

为了将四次项的系数化成 1 得到 [Monic Polynomial]，将上述每个系数都除以 $k_4$，而且是椭圆的缘故不用担心除以 0 的问题。同时使用 $m n$ 代入：

$$ m=x \frac{a}{b^{2}-a^{2}} \quad n=y \frac{b}{b^{2}-a^{2}} $$

这样就得到了 [Quartic Equation]，各项系数如下：

$$
\displaylines{
  a_4=1\\
  a_3=2m \\
  a_2=m^2 + n^2  - 1 \\
  a_1=-2m \\
  a_0=-m^2
}
$$

由于最高次系数为 1，可以使用 [Resolvent Cubic]，转化为对一元三次方程的求解问题：

$$
\displaylines{
f(x)=x^4+a_3x^3+a_2x^2+a_1x+a_0 \\
g(x)=x^3+b_2x^2+b_1x+b_0
}
$$

其中系数的对应关系为：

$$
b_2 = -a_2 \quad
b_1 = a_1a_3-4a_0 \quad
b_0 = 4a_0a_2-a_1^2-a_0a_3^2
$$

代入后：

$$
b_2 = -(m^2+n^2-1) \quad
b_1 = 0 \quad
b_0 = -4m^2n^2
$$

带有 $PQR$ 的标准形式

这种方法计算开销很大，[Distance to an ellipse] 中展示了在 ShaderToy 上编写的例子，和下面要介绍的两种方法相比 FPS 会低很多。

### 牛顿法 {#newton-method}

任意点 $p$ 到椭圆上距离最近点 $q$ 形成的向量一定是垂直于椭圆在 $q$ 点的切线的。

$$ <p-q(\omega)), q'(\omega)> = 0 $$

其中：

$$ q'(\omega) = (-a⋅sin \omega, b⋅cos \omega) $$

代入后得到：

$$
\displaylines{
  f(\omega) = -a⋅sin \omega ⋅(x-a⋅cos \omega) + b⋅cos \omega ⋅(y-b⋅sin \omega) = 0 \\
  f'(\omega) = -<p-u,v> - <v,v> \\

  u = ( a⋅cos \omega, b⋅sin \omega ) \\
  v = (-a⋅sin \omega, b⋅cos \omega )
}
$$

[Newton's method]，它是一种在实数域和复数域上近似求解方程的方法。

$$x_{n+1} =x_n-{\frac {f(x_n)}{f'(x_n)}} $$

代入后得到：

$$\omega_{n+1} = \omega_n + {\frac {<p-u,v>}{<p-u,u> + <v,v>}} $$

[Distance to an ellipse] 原作者使用了 5 次迭代就可以达到非常好的效果：

```glsl
for (int i=0; i<5; i++) {
  vec2 cs = vec2(cos(w),sin(w));
  vec2 u = ab*vec2( cs.x,cs.y);
  vec2 v = ab*vec2(-cs.y,cs.x);
  w = w + dot(p-u,v)/(dot(p-u,u)+dot(v,v));
}
```

下面只需要找到 $\omega_0$。还是利用对称性，只考虑点在第一象限的情况，首先判断点是否在椭圆内，代入椭圆方程即可：

```glsl
bool s = dot(p/ab,p/ab)>1.0;
```

如果在椭圆外，可以先拉伸成圆（下面一小节介绍的方法也会用到），此时 $\omega_0 = atan(y / x)$，再反向拉伸回椭圆： $\omega_0 = atan(a⋅y / b⋅x)$

如果在椭圆内，选择半长轴 $0$ 或短轴 $\pi/2$ 作为起点：

```glsl
float w = s ? atan(p.y*ab.x, p.x*ab.y) :
  ((ab.x*(p.x-ab.x)<ab.y*(p.y-ab.y))? 1.5707963 : 0.0);
```

相比之前解一元四次方程，这种方法的开销要小一些。但毕竟还是包含一个固定迭代次数的 for 循环，在编译 GLSL 时会将循环展开，可参考：[Loop performance in a shader]。
最后我们会介绍一种近似估计的方法，开销是最小的。

### 拉伸成圆近似法 {#stretch-approximately-method}

[Ellipsoid SDF] 介绍了这种方法，先拉伸成单位圆，再恢复成椭圆。但在恢复时如何选择拉伸系数呢？如果点在 X 轴上，系数就是 `r.x`，在 Y 轴上是 `r.y`，首先选择两者的较小值：

```glsl
float sdf_ellipse_V1( in vec2 p, in vec2 r )
{
  float k1 = length(p/r);
  return (k1-1.0)*min(r.x,r.y);
}
```

实际渲染后发现这种方式在长轴处存在明显的问题，并不贴合：

![artifact on ellipse's edge](/ellipse-approximate-v1.png)

作者给出了改进版，加入了对梯度的考虑，我们也使用这种方式：

```glsl
float sdf_ellipse_V2( in vec2 p, in vec2 r )
{
  float k1 = length(p/r);
  float k2 = length(p/(r*r));
  return k1*(k1-1.0)/k2;
}
```

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas-lesson9');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Ellipse } = Lesson9;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas.parentElement.style.position = 'relative';
    $icCanvas.parentElement.appendChild($stats);

    $icCanvas.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        for (let i = 0; i < 1000; i++) {
            const ellipse = new Ellipse({
                cx: Math.random() * 1000,
                cy: Math.random() * 1000,
                rx: Math.random() * 20,
                ry: Math.random() * 20,
                fill: `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
                    Math.random() * 255,
                )},${Math.floor(Math.random() * 255)})`,
            });
            canvas.appendChild(ellipse);
        }
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

## 扩展阅读 {#extended-reading}

-   [Distance to an ellipse]
-   [Distance from a Point to an Ellipse, an Ellipsoid, or a
    Hyperellipsoid]

[课程 2]: /zh/guide/lesson-002
[2D distance functions]: https://iquilezles.org/articles/distfunctions2d/
[Distance to an ellipse]: https://iquilezles.org/articles/ellipsedist/
[Ellipsoid SDF]: https://iquilezles.org/articles/ellipsoids/
[The SDF of a Box]: https://www.youtube.com/watch?v=62-pRVZuS5c&t=18s&ab_channel=InigoQuilez
[Leveraging Rust and the GPU to render user interfaces at 120 FPS]: https://zed.dev/blog/videogame
[Blurred rounded rectangles]: https://raphlinus.github.io/graphics/2020/04/21/blurred-rounded-rects.html
[Shape Lens Blur Effect with SDFs and WebGL]: https://tympanus.net/codrops/2024/06/12/shape-lens-blur-effect-with-sdfs-and-webgl/
[Quartic Equation]: https://mathworld.wolfram.com/QuarticEquation.html
[Monic Polynomial]: https://mathworld.wolfram.com/MonicPolynomial.html
[Resolvent Cubic]: https://mathworld.wolfram.com/ResolventCubic.html
[Newton's method]: https://en.wikipedia.org/wiki/Newton%27s_method
[Distance from a Point to an Ellipse, an Ellipsoid, or a Hyperellipsoid]: https://www.geometrictools.com/Documentation/DistancePointEllipseEllipsoid.pdf
[Loop performance in a shader]: https://computergraphics.stackexchange.com/questions/2153/loop-performance-in-a-shader
