---
outline: deep
description: '線ジオメトリとスクリーン空間の手法で直線を描く方法を学びます。グリッドと点のパターンを実装し、図形にワイヤーフレーム描画を追加します。'
head:
    - ['meta', { property: 'og:title', content: '第5課 - グリッド' }]
---

# 第 5 課 - グリッド {#lesson-5-grid}

この課では、次の内容を学びます。

-   線ジオメトリ（Line Geometry）、またはスクリーン空間の手法で直線を描きます。
-   点グリッドを描きます。
-   ジオメトリのワイヤーフレームを描きます。

```js eval code=false
$button = call(() => {
    const $button = document.createElement('button');
    $button.textContent = 'FlyTo origin';
    return $button;
});
```

```js eval code=false
checkboardStyle = Inputs.radio(['none', 'grid', 'dots'], {
    label: 'Checkboard Style',
    value: 'grid',
});
```

```js eval code=false inspector=false
canvas = call(() => {
    const { Canvas } = Lesson5;
    return Utils.createCanvas(Canvas, 400, 400);
});
```

```js eval code=false inspector=false
call(() => {
    const styles = ['none', 'grid', 'dots'];
    canvas.setCheckboardStyle(styles.indexOf(checkboardStyle));
});
```

```js eval code=false
(async () => {
    const { Canvas, Circle, Group } = Lesson5;

    const solarSystem = new Group();
    const earthOrbit = new Group();
    const moonOrbit = new Group();

    const sun = new Circle({
        cx: 0,
        cy: 0,
        r: 100,
        fill: 'red',
    });
    const earth = new Circle({
        cx: 0,
        cy: 0,
        r: 50,
        fill: 'blue',
    });
    const moon = new Circle({
        cx: 0,
        cy: 0,
        r: 25,
        fill: 'yellow',
    });
    solarSystem.appendChild(sun);
    solarSystem.appendChild(earthOrbit);
    earthOrbit.appendChild(earth);
    earthOrbit.appendChild(moonOrbit);
    moonOrbit.appendChild(moon);

    solarSystem.position.x = 200;
    solarSystem.position.y = 200;
    earthOrbit.position.x = 100;
    moonOrbit.position.x = 100;

    canvas.appendChild(solarSystem);

    let id;
    const animate = () => {
        solarSystem.rotation += 0.01;
        earthOrbit.rotation += 0.02;
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });

    const landmark = canvas.camera.createLandmark({
        x: 0,
        y: 0,
        zoom: 1,
        rotation: 0,
    });
    $button.onclick = () => {
        canvas.camera.gotoLandmark(landmark, {
            duration: 1000,
            easing: 'ease',
        });
    };

    return canvas.getDOM();
})();
```

Figma と FigJam では、ある倍率まで拡大するとグリッドが表示されます。前者は線、後者は点として表示されます。

![FigJam のグリッド](/figjam-grid.png)

Miro は線と点の切り替えに対応しています。

![Miro のグリッド](/miro-grid.png)

まずは直線グリッドから始めます。

## 直線グリッド {#lines-grid}

まず、グリッドはシーングラフの一部であってはなりません。キャンバスをズームしたときに、グリッドまで拡大縮小されては困るからです。その一方で、ズームに合わせてフェードインとフェードアウトはさせたいのです。そこで `beginFrame` フックの中でグリッドを先に描画し、カメラのようにシーンから必要な情報を渡します。

```ts
hooks.initAsync.tapPromise(async () => {
    this.#grid = new Grid();
});
hooks.beginFrame.tap(() => {
    this.#grid.render(
        this.#device,
        this.#renderPass,
        this.#uniformBuffer,
        camera,
    );
});
```

### 線ジオメトリ {#line-geometry}

最も素直な方法は [GridHelper - Three.js] に近く、グリッドのサイズに基づいて線分の集合を作ります。

```ts
// https://github.com/mrdoob/three.js/blob/master/src/helpers/GridHelper.js#L25-L37
for (var i = 0, j = 0, k = -halfSize; i <= divisions; i++, k += step) {
    vertices.push(-halfSize, 0, k, halfSize, 0, k);
    vertices.push(k, 0, -halfSize, k, 0, halfSize);
}

var geometry = new BufferGeometry();
geometry.addAttribute('position', new Float32BufferAttribute(vertices, 3));
geometry.addAttribute('color', new Float32BufferAttribute(colors, 3));

var material = new LineBasicMaterial({ vertexColors: VertexColors });
LineSegments.call(this, geometry, material);
```

Figma の CTO である Evan の [thetamath] プロジェクトでも、グリッドはこのように実装されています。水平方向と垂直方向の両方から、グリッドに必要な線分を組み立てます。

```ts
for (let x = left; x < right; x++) {
    const tx = ox + (x * zoom) / step;
    this.strokeLine();
}
for (let y = top; y < bottom; y++) {
    const ty = oy - (y * zoom) / step;
    this.strokeLine();
}
```

WebGL で直線はどう描くのでしょうか。以前、[Drawing Straight Lines in WebGL (Chinese)] という文章を書きました。かいつまんで言うと、接合を考えなければ、法線方向に両側へ外側へ押し出し、三角形を 2 つ使って描けば足ります。

![線の押し出し](https://pica.zhimg.com/70/v2-afa28c8cf89369a162816f21b7f53314_1440w.avis?source=172ae18b&biz_tag=Post)

[thetamath] は、小さな工夫を 2 つ使っています。1 つ目は [Triangle strip] です。通常の `Triangles` と比べて頂点数を節約でき、三角形の数を `N` とすると `3N` から `N + 2` になります。

```ts{5}
this.#pipeline = device.createRenderPipeline({
    inputLayout: this.#inputLayout,
    program: this.#program,
    colorAttachmentFormats: [Format.U8_RGBA_RT],
    topology: PrimitiveTopology.TRIANGLE_STRIP,
});
```

2 つ目として、色を 4 つの `Bytes` に格納します。

```ts
255 | (255 << 8) | (255 << 16) | (127 << 24);
```

[vertexAttribPointer] とあわせて、各成分が `gl.UNSIGNED_BYTE` であり、正規化が必要だと宣言します。

```ts{13}
this.#inputLayout = device.createInputLayout({
  vertexBufferDescriptors: [
    {
      arrayStride: 4 * 5,
      stepMode: VertexStepMode.VERTEX,
      attributes: [
        {
          format: Format.F32_RGBA,
          offset: 0,
          shaderLocation: 0,
        },
        {
          format: Format.U8_RGBA_NORM,
          offset: 4 * 4,
          shaderLocation: 1,
        },
      ],
    },
  ],
  indexBufferFormat: null,
  program: this.#program,
});
```

試してみましょう。

```js eval code=false
(async () => {
    const { Canvas, Circle, Group } = Lesson5;
    const canvas = await Utils.createCanvas(Canvas, 400, 400);
    const $canvas = canvas.getDOM();

    canvas.setGridImplementation(0);

    const solarSystem = new Group();
    const earthOrbit = new Group();
    const moonOrbit = new Group();

    const sun = new Circle({
        cx: 0,
        cy: 0,
        r: 100,
        fill: 'red',
    });
    const earth = new Circle({
        cx: 0,
        cy: 0,
        r: 50,
        fill: 'blue',
    });
    const moon = new Circle({
        cx: 0,
        cy: 0,
        r: 25,
        fill: 'yellow',
    });
    solarSystem.appendChild(sun);
    solarSystem.appendChild(earthOrbit);
    earthOrbit.appendChild(earth);
    earthOrbit.appendChild(moonOrbit);
    moonOrbit.appendChild(moon);

    solarSystem.position.x = 200;
    solarSystem.position.y = 200;
    earthOrbit.position.x = 100;
    moonOrbit.position.x = 100;

    canvas.appendChild(solarSystem);

    let id;
    const animate = () => {
        solarSystem.rotation += 0.01;
        earthOrbit.rotation += 0.02;
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });

    return $canvas;
})();
```

この方法では、キャンバスが大きいほど、またグリッドが密なほど、必要な頂点が増えます。もっと少ない頂点で実現する方法はないでしょうか。グリッドは常に画面全体を覆うので、スクリーン空間で済ませられないでしょうか。

### フラグメントシェーダーのパターン {#patterns-in-fragment-shader}

[Building Flexible and Powerful Cross-Sections with GridPaper and WebGL] には、次のようにあります。

> これらの線をすべてジオメトリとして描画する代わりに、WebGL のフラグメントシェーダーを使って、ピクセルごとに線を生成できます。

スクリーン空間で実装する利点は、画面を覆う Quad が 1 枚あれば足り、必要な頂点は 4 つだけだということです。その頂点にはクリップ座標系の座標を渡します。もちろん、頂点が 3 つで済むフルスクリーン三角形を使うこともできます。この手法はポストプロセスではよく使われます。

```ts
this.appendVertex(-1, -1);
this.appendVertex(-1, 1);
this.appendVertex(1, -1);
this.appendVertex(1, 1);
```

こうすれば、頂点シェーダーでは変換なしに、そのまま使えます。

```glsl
layout(location = 0) in vec4 a_Position;
void main() {
  gl_Position = vec4(a_Position.xy, 0, 1);
}
```

フラグメントシェーダーでグリッドを描くには、ピクセルのワールド座標系における座標が必要です。そこで、カメラの投影変換行列の逆行列を使えば、クリップ座標系の座標をワールド座標系へ変換できます。

```glsl{4}
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
  mat3 u_ViewMatrix;
  mat3 u_ViewProjectionInvMatrix;
};

out vec2 v_Position;

vec2 project_clipspace_to_world(vec2 p) {
  return (u_ViewProjectionInvMatrix * vec3(p, 1.0)).xy;
}

void main() {
  v_Position = project_clipspace_to_world(a_Position.xy);
}
```

Canvas2D と SVG では、グリッドは Pattern で実装されることが一般的です。フラグメントシェーダーで実装する基本的な考え方も近く、組み込み関数 `fract` で Pattern を描きます。最初の座標空間を n 倍に拡大してから `fract` で小数部を取り出せば、座標範囲が `0-1` の小さな区画だけを考えれば済みます。詳しくは [the book of shaders - Patterns] を参照してください。

![パターン](https://pic4.zhimg.com/80/v2-1f7b0bc49eefe692f5a3c5935725feef_1440w.webp)

次のコードは、Evan の [Anti-Aliased Grid Shader] からのものです。

```ts
vec4 render_grid_checkerboard(vec2 coord) {
  // Compute anti-aliased world-space grid lines
  vec2 grid = abs(fract(coord / gridSize - 0.5) - 0.5) / fwidth(coord) * gridSize;
  float line = min(grid.x, grid.y);
  float alpha = 1.0 - min(line, 1.0);
}
```

太さの異なるグリッドを 2 組描きたいのです。細かいグリッドの間隔は、粗いグリッドの `1/5` です。同時に、現在のピクセルが粗いグリッドのほうに近いかどうかも調べます。

```glsl
vec2 size = scale_grid_size(u_ZoomScale);
float gridSize1 = size.x;
float gridSize2 = gridSize1 / 5.0;
```

### テクスチャベースのグリッド {#texture-based}

[The Best Darn Grid Shader (Yet)] は、テクスチャに基づく別の方式を説明しています。特に線そのものにもパースを持たせたいとき、この方式はスクリーン空間の固定幅グリッドよりうまく働きます。たとえば下の図では、右側に明らかな「モアレ」があり、左側のより遠い線はより細く、色もより暗くなります。

![テクスチャグリッドと線グリッド](https://miro.medium.com/v2/resize:fit:1360/format:webp/1*P4a5_Z1u5WXOQWpVglPb2g.png)

元の記事では、著者はパースに応じた太さの改善や「モアレ」模様の緩和など、いくつかの改良を加えています。Shadertoy 上の例は次のとおりです。

<iframe width="640" height="360" frameborder="0" src="https://www.shadertoy.com/embed/mdVfWw?gui=true&t=10&paused=true&muted=false" allowfullscreen></iframe>

## 点グリッド {#dots-grid}

点グリッドも、スクリーン空間のフラグメントシェーダーで扱うことにします。以前扱った Signed Distance Field（SDF）で円を描くこともできますが、それには大量の頂点が必要になります。そこで直線グリッドの Pattern を引き続き再利用し、ここでは SDF を使って、ピクセルが円の内側にあるかどうかだけを判定します。この方法は第 2 課で既に扱いました。

```glsl
vec2 grid2 = abs(fract(coord / gridSize2 - 0.5) - 0.5) / fwidth(coord) * gridSize2;
alpha = 1.0 - smoothstep(0.0, 1.0, length(grid2) - BASE_DOT_SIZE * u_ZoomScale / zoomStep);
```

直線グリッドと点グリッドを切り替えるには、グリッドのスタイルを区別する新しいユニフォーム変数を導入できます。

```glsl{6}
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
  mat3 u_ViewMatrix;
  mat3 u_ViewProjectionInvMatrix;
  float u_ZoomScale;
  float u_CheckboardStyle;
};
```

これで、フラグメントシェーダーでは次のように別々のグリッドを描けます。

```glsl
const int CHECKERBOARD_STYLE_NONE = 0;
const int CHECKERBOARD_STYLE_GRID = 1;
const int CHECKERBOARD_STYLE_DOTS = 2;

vec4 render_grid_checkerboard(vec2 coord) {
  int checkboardStyle = int(floor(u_CheckboardStyle + 0.5));
  if (checkboardStyle == CHECKERBOARD_STYLE_GRID) {
    // lines grid
  } else if (checkboardStyle == CHECKERBOARD_STYLE_DOTS) {
    // dots grid
  }
}
```

ページ先頭の例に戻って、グリッドのスタイルを切り替えてみてください。

最後に、マウス操作を取り入れた興味深い例を紹介します。[How to Code a Subtle Shader Background Effect with React Three Fiber]

<video autoplay="" controls="" loop="" muted="" src="https://codrops-1f606.kxcdn.com/codrops/wp-content/uploads/2024/10/shaderbackground.mp4?x39556" playsinline=""></video>

## 明るさの調整 {#adjusting-brightness}

Figma / FigJam で使われるシェーダーでは、色の明るさも計算し、その明るさの値に基づいて色を調整します。具体的には、明るさに基づく色調整アルゴリズムを使い、色の見え方を整え、より明るい背景の上でもテキストや図形がはっきり見えるようにします。

重みベクトル `weights` を定義しています。重みは、人の目が色ごとに明るさを非線形に知覚する特性に合わせて設定してあり、RGB 色空間で明るさの値を計算するときによく使われます。

```glsl{2}
vec3 gridColor; // Store the final adjusted color value
vec3 weights = vec3(0.299, 0.587, 0.114);
float c2 = dot(rgb * rgb, weights); // Calculate weighted sum of squares of RGB, c2 is an estimate of color brightness
float luminance = sqrt(c2);
```

明るさの値が 0.5 より大きい場合、色そのものが既にかなり明るいことを示します。コードは調整係数 target を計算し、それを使って色の値 rgb を変え、色を少し暗くします。この変更により、明るい背景の上でも色を観察しやすくなります。明るさの値が 0.5 より大きくない場合、色そのものは比較的暗いので、コードは別の方針で色を調整します。

まず新しい明るさの目標値 target を計算し、次に `b` と `a` の計算結果に基づいて `mix` 関数で rgb の色と純白 `vec3(1)` を混ぜます。最終的な色の混合比は、`b` と `a` の関係で決まります。ここで `a` と `b` は元の色の明るさの値から計算され、色の調整過程を制御するために使われます。

```glsl
if (luminance > 0.5) {
    float target = (luminance - 0.05) / luminance;
    gridColor = rgb * target;
}
else {
    float target = luminance * 0.8 + 0.15;
    float c1 = dot(rgb, weights);
    float a = 1.0 - 2.0 * c1 + c2;
    float b = c2 - c1;
    gridColor = mix(rgb, vec3(1), (b + sqrt(b * b - a * (c2 - target * target))) / a);
}
rgb = mix(rgb, gridColor, gridWeight);
```

## ワイヤーフレームを描く {#wireframe}

ワイヤーフレームの描画も似た手法を使い、[ポリラインを描く][Draw polyline] のような複雑なジオメトリのデバッグに使えます。

### 重心座標 {#barycentric-coordinates}

考え方は、実際にはとても単純です。ラスタライズの間に各三角形へワイヤーフレームを描きたいので、現在のフラグメントが三角形の 3 辺からどれだけ離れているかを知る必要があります。その距離が枠の幅より小さくなれば、現在のフラグメントを枠の色で塗ります。鍵となるのは、フラグメントから三角形の 3 辺までの距離をどう計算するかです。重心座標を使えます。気にするのは現在のフラグメントが属する三角形だけなので、3 頂点の重心座標で重心座標系を作り、フラグメントシェーダーの補間によって現在のフラグメントの重心座標を得ます。

実際、レンダリングパイプラインも重心座標を重みとして使い、フラグメントの色を決めています。下の図のとおりです。scratchapixel にあるラスタライズ実装の記事を、続けて読めます。[Rasterization]。

![重心座標](https://www.scratchapixel.com/images/rasterization/barycentric2.png)

具体的な実装を見ます。まず頂点に重心座標を渡します。三角形の 3 頂点の座標が `(1,0,0)`、`(0,1,0)`、`(0,0,1)` になるようにする必要があります。描画時に `gl.drawArrays()` を使うなら、3 頂点の座標を順番に渡し、三角形の数だけ繰り返せば足ります。たとえば次のとおりです。

```glsl
layout(location = BARYCENTRIC) in vec3 a_Barycentric;
out vec3 v_Barycentric;

void main() {
  v_Barycentric = a_Barycentric;
}
```

続いてフラグメントシェーダーでは、重心座標のいずれかの成分が枠の幅のしきい値より小さければ、枠とみなせます。ここでは glsl の組み込み関数 `any()` と `lessThan()` を使います。

```glsl
in vec3 v_Barycentric;
void main() {
  // less than border width
  if (any(lessThan(v_Barycentric, vec3(0.1)))) {
    // border color
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    // fill background color
    gl_FragColor = vec4(0.5, 0.5, 0.5, 1.0);
  }
}
```

先ほどの直線グリッドの例と同じく、カメラのズームにかかわらず線幅を一定に保ちたいので、引き続き `fwidth()` を使います。

```glsl
float edgeFactor() {
  vec3 d = fwidth(v_Barycentric);
  vec3 a3 = smoothstep(vec3(0.0), d * u_WireframeLineWidth, v_Barycentric);
  return min(min(a3.x, a3.y), a3.z);
}
```

### 頂点データの再割り当て {#reallocate-vertex-data}

前の例では、描画時に `gl.drawArrays()` を使いました。しかし、バッファ空間をより節約する `gl.drawElements()` を使う場合、つまり一部の頂点を共有する場合（たとえば平面は頂点 6 個ではなく 4 個だけを使います）、頂点の順序だけから重心座標を単純に割り当てることはできず、頂点インデックスに基づいて割り当てる必要があります。ただし、すべての割り当て方がこれほど単純なわけではありません。たとえば Stack Overflow のこの問題 [Issue with Barycentric coordinates when using shared vertices] を見ると、`?` には割り当てられないことが分かります。根本的な理由は、頂点を共有する場合、ある三角形に重心座標を割り当ててしまうと、同じ辺を共有する次の三角形の残りの 1 頂点の座標は、実際には既に決まってしまうからです。

![疑問符に対応する重心座標はありません](https://pica.zhimg.com/v2-30c2f4ab848d5f0cfcf8f6934b030298_b.jpg)

したがって、ワイヤーフレームを有効にしたときは、再利用されているインデックスを展開する必要があります。たとえば、4 個のインデックス `[0, 1, 2, 0, 2, 3]` を使っていた元の 6 頂点は `[0, 1, 2, 3, 4, 5]` に展開され、頂点配列のデータも再割り当てする必要があります。

```ts
let cursor = 0;
const uniqueIndices = new Uint32Array(indiceNum); // Reallocate indices
for (let i = 0; i < indiceNum; i++) {
    const ii = this.#indexBufferData[i];
    for (let j = 0; j < bufferDatas.length; j++) {
        const { arrayStride } = this.#vertexBufferDescriptors[j];
        const size = arrayStride / 4;
        for (let k = 0; k < size; k++) {
            bufferDatas[j][cursor * size + k] =
                originalVertexBuffers[j][ii * size + k]; // Reallocate vertex data
        }
    }
    uniqueIndices[i] = cursor;
    cursor++;
}
```

結果は次のとおりです。図形の描き方は、このあとさらに紹介します。

<script setup>
import Wireframe from '../../components/Wireframe.vue'
</script>

<Wireframe />

## さらに読む {#extended-reading}

-   [thetamath]
-   [The Best Darn Grid Shader (Yet)]
-   [Drawing Grid in WebGL (Chinese)]
-   [How to Draw Plane Grid Lines with WebGL (Chinese)]
-   [How to Code a Subtle Shader Background Effect with React Three Fiber]
-   [Love, derivatives and loops]

[thetamath]: http://thetamath.com/app/y=x%5E(3)-x
[GridHelper - Three.js]: https://threejs.org/docs/#api/en/helpers/GridHelper
[Drawing Grid in WebGL (Chinese)]: https://zhuanlan.zhihu.com/p/66637363
[How to Draw Plane Grid Lines with WebGL (Chinese)]: https://www.zhihu.com/question/325261675/answer/3149510989
[Drawing Straight Lines in WebGL (Chinese)]: https://zhuanlan.zhihu.com/p/59541559
[Triangle strip]: https://en.wikipedia.org/wiki/Triangle_strip
[Building Flexible and Powerful Cross-Sections with GridPaper and WebGL]: https://medium.com/life-at-propeller/building-flexible-and-powerful-cross-sections-with-gridpaper-and-webgl-c5b3b9929c71
[vertexAttribPointer]: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/vertexAttribPointer
[the book of shaders - Patterns]: https://thebookofshaders.com/09/?lan=ch
[Anti-Aliased Grid Shader]: https://madebyevan.com/shaders/grid/
[The Best Darn Grid Shader (Yet)]: https://bgolus.medium.com/the-best-darn-grid-shader-yet-727f9278b9d8
[Draw polyline]: /ja/guide/lesson-012
[Rasterization]: https://www.scratchapixel.com/lessons/3d-basic-rendering/rasterization-practical-implementation/rasterization-stage.html
[Issue with Barycentric coordinates when using shared vertices]: https://stackoverflow.com/questions/24839857/wireframe-shader-issue-with-barycentric-coordinates-when-using-shared-vertices
[How to Code a Subtle Shader Background Effect with React Three Fiber]: https://tympanus.net/codrops/2024/10/31/how-to-code-a-subtle-shader-background-effect-with-react-three-fiber/
[Love, derivatives and loops]: https://medium.com/@akella/love-derivatives-and-loops-f4a0da6e2458
