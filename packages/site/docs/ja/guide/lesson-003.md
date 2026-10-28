---
outline: deep
description: '変換（平行移動、拡大縮小、回転、スキュー）とシーングラフのアーキテクチャを実装します。階層的な変換と座標系を示す、簡単な太陽系モデルを作ります。'
head:
    - ['meta', { property: 'og:title', content: '第3課 - シーングラフと変換' }]
---

# 第 3 課 - シーングラフと変換 {#lesson-3-scene-graph-and-transform}

前の課では円を描きました。この課では、次のことを学びます。

-   変換。図形が平行移動、拡大縮小、回転、スキューの変換に対応するようにします。
-   シーングラフ。

最後に、以上の機能を使って、簡単な太陽系のモデルを作ります。

```js eval code=false
(async () => {
    const { Canvas, Circle, Group } = Lesson3;
    const canvas = await Utils.createCanvas(Canvas, 400, 400);

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
    return canvas.getDOM();
})();
```

## 変換 {#transform}

[CSS Transform] は、`translate`、`scale`、`rotate`、`skew` という変換を提供します。
これらの変換の背後にある行列は [Transformations - LearnOpenGL] にあります。シーンに含まれるのは 2D グラフィックスだけなので、必要なのは 3x3 の行列だけです。最後の行 `[0, 0, 1]` は固定なので、実際に保存する必要があるのは行列の 6 要素だけです。

```bash
| a | c | tx|
| b | d | ty|
| 0 | 0 | 1 |
```

図形の基底クラスには、[@pixi/math] をそのまま使って `transform` 属性を追加します。もちろん [gl-matrix] を選ぶこともできます。

```ts
import { Transform } from '@pixi/math';

export abstract class Shape {
    transform = new Transform();
}
```

メソッドを増やす前に、重要な概念を紹介しましょう。

### ローカル座標とワールド座標 {#local-and-world-coordinates}

座標系は、シーン内のオブジェクトの位置、回転、拡大縮小を表すために使えます。最もよく知られている座標系はユークリッド座標系です。グラフィックスでは重心座標系も使います。ユークリッド空間は最大で N 次元まで含めますが、ここでは 2 次元だけを使います。

「月は地球の周りを回る」と言うとき、実際には地球以外のオブジェクトを無視しています。月のローカル座標系では、月は単にある点の周りを回転しているだけです。太陽系全体のワールド座標系では、地球はなお太陽の周りを回転しており、月は最終的に、上で述べた複雑な軌道をたどります。

ローカル座標系とワールド座標系の概念は、2D と 3D の世界のどちらでも使えます。下の図は [playcanvas] からのもので、左側がワールド座標系です。軸が常に同じであることが分かります。右側は立方体のローカル座標系で、軸はオブジェクトの変換（この場合は回転）に合わせて変わります。そのため、この回転したオブジェクトがこの時点で X 軸（赤）の正方向へ平行移動すると、地面の下に潜り込むことがあります。

![ワールド空間（左）とローカル空間（右）](https://gw.alipayobjects.com/mdn/rms_6ae20b/afts/img/A*kgaHRIYex8MAAAAAAAAAAAAAARQnAQ)

ワールド座標系はシーングラフ内のすべてのノードで共有されるため、原点は `(0, 0)` に固定され、XYZ 軸（2D シーンでは XY 軸）の向きも固定です。シーン内の箱自身が回転しても、その箱にとってワールド座標系は変わりません。一方、自身のローカル座標系では、原点はもはや `(0, 0)` ではなくオブジェクト自身の位置になり、軸も当然変わります。名前のとおり、オブジェクト自身に結びついています。

箱を「X 軸（赤）に沿って 10 単位動かす」ことを想像してください。座標系が違えば、意味はまったく異なります。したがって、オブジェクトを変換するときは、まずそれがどの座標系にあるのかを指定しなければなりません。

加えて、ローカル座標系は**モデル座標系**とも呼ばれ、モデル自身の変換を記述するときに便利です。各兵士に頭を向けさせたいなら、ローカル座標系で行うほうが明らかに簡単です。「向ける」という変換は、各モデルの頭を基準にしているからです。
![ローカル空間とワールド空間](https://gw.alipayobjects.com/mdn/rms_6ae20b/afts/img/A*9B4FRo4UbNsAAAAAAAAAAAAAARQnAQ)

図形の基底クラスに、ローカル座標系とワールド座標系での変換メソッドを追加します。これらは [@pixi/math] で提供されています。

```ts
export abstract class Shape {
    get localTransform(): Matrix {
        return this.transform.localTransform;
    }
    get worldTransform(): Matrix {
        return this.transform.worldTransform;
    }
}
```

下の図は [Fundamentals of Computer Graphics 4th Edition] からのものです。ローカル（オブジェクト）座標系がモデル変換によってワールド座標系へ移り、次にカメラ変換によってカメラ座標系へ、さらに投影変換によってクリップ座標系（clip space/NDC）へ、最後にビューポート変換によってスクリーン座標系（screen/pixel space）へ移る様子を示しています。カメラは後で紹介します。今のところ、気にする必要があるのはモデル変換だけです。

![座標系](/coordinates.png)

次に、頂点の位置を変換するため、モデル変換行列をシェーダーへ渡す必要があります。

### アライメント {#alignment}

頂点シェーダーでは、モデル変換行列を Uniform 経由で渡し、位置ベクトルに左から掛けます。

```glsl
layout(std140) uniform ShapeUniforms {
  mat3 u_ModelMatrix;
};

vec2 position = (u_ModelMatrix * vec3(a_Position + a_Size * a_FragCoord, 1)).xy;
```

当然、長さ 9（3 \* 3 の行列）の `Float32Array` を直接作ります。

```ts
this.#uniformBuffer = device.createBuffer({
    viewOrSize: Float32Array.BYTES_PER_ELEMENT * 9, // mat3
    usage: BufferUsage.UNIFORM,
    hint: BufferFrequencyHint.DYNAMIC,
});
```

しかしその後、コンソールは、作成した Uniform Buffer の長さが足りないというエラーを出します。何が起きているのでしょうか。

```bash
[.WebGL-0x10800c78f00] GL_INVALID_OPERATION: It is undefined behaviour to use a uniform buffer that is too small.
```

ここで [Memory layout] の概念を導入する必要があります。Uniform Block は `packed`、`shared`、`std140`、`std430` というレイアウトルールに対応しています。レイアウトルールが違うと、バッファ内のデータを格納する方法と読み出す方法が変わります。`std140` を選ぶ利点は、Program 間でレイアウトの違いがないこと（`packed` と比べて）、OpenGL の実装間でも違いがないこと（`shared` と比べて）です。欠点は、アライメントを手動で扱う必要があることです。公式サイトのドキュメントはこの点について警告しており、アライメントを避けるために `vec3` を使わないよう促しています。

> 警告: 実装によっては、vec3 コンポーネントの std140 レイアウトを誤ることがあります。構造体や配列には手動でパディングを入れ、vec3 はまったく使わないようにすることを勧めます。

では、アライメントとは何でしょうか。`vec3` を例に取ると、長さは `4 * 3` バイトですが、実際に占めるのは 16 バイトです。実際のアライメント規則は非常に複雑で、ここでの `mat3` が実際に必要とするストレージは `4 * 12` バイトです。

```ts
this.#uniformBuffer = device.createBuffer({
    viewOrSize: Float32Array.BYTES_PER_ELEMENT * 12, // mat3
    usage: BufferUsage.UNIFORM,
});
```

[wgsl-offset-computer] は、可視化を通じてアライメント規則を理解するのに役立つ、優れたオンラインツールです。

![構造体: ShapeUniforms](/wgsl-offset-computer.png)

データを書き込むときは、手動でパディングを追加する必要があります。

```bash
| a | c | tx|
| b | d | ty|
| 0 | 0 | 1 |
| padding | padding | padding |
```

```ts
const PADDING = 0;
const { a, b, c, d, tx, ty } = this.worldTransform;
this.#uniformBuffer.setSubData(
    0,
    new Uint8Array(
        new Float32Array([
            a,
            b,
            0,
            PADDING,
            c,
            d,
            0,
            PADDING,
            tx,
            ty,
            1,
            PADDING,
        ]).buffer,
    ),
);
```

なお、WGSL にも同じ [Alignment of Uniform and Storage buffers] があり、Rust のエコシステムにはアライメントを自動化する [bytemuck] があります。次の例は [bevy] からのものです。

```rust
use bytemuck::{Pod, Zeroable};

#[repr(C)]
#[derive(Copy, Clone, Pod, Zeroable)]
pub struct UiMaterialVertex {
    pub position: [f32; 3],
    pub uv: [f32; 2],
    pub border_widths: [f32; 4],
}
```

図形に、平行移動、回転、拡大縮小などの変換 API を追加しましょう。

### 平行移動 {#translation}

[WebGL 2D Translation]

```ts
export abstract class Shape {
    get position(): ObservablePoint {
        return this.transform.position;
    }
    set position(value: IPointData) {
        this.transform.position.copyFrom(value);
    }

    get x(): number {
        return this.position.x;
    }
    set x(value: number) {
        this.transform.position.x = value;
    }

    get y(): number {
        return this.position.y;
    }
    set y(value: number) {
        this.transform.position.y = value;
    }
}
```

使い方は PIXI.js と同じです。

```js eval code=false
circle = call(() => {
    const { Circle } = Lesson3;
    return new Circle({
        cx: 100,
        cy: 100,
        r: 50,
        fill: 'red',
    });
});
```

```js eval code=false
positionX = Inputs.range([0, 100], { label: 'position.x', value: 0, step: 1 });
```

```js eval code=false
positionY = Inputs.range([0, 100], { label: 'position.y', value: 0, step: 1 });
```

```js eval
call(() => {
    circle.position.x = positionX;
    circle.position.y = positionY;
});
```

```js eval code=false
(async () => {
    const { Canvas } = Lesson3;
    const canvas = await Utils.createCanvas(Canvas, 200, 200);
    canvas.appendChild(circle);

    let id;
    const animate = () => {
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });
    return canvas.getDOM();
})();
```

### ピボット {#pivot}

回転、拡大縮小、スキューでは、変換の中心を指定する必要があります。Pixi.js ではこれを `pivot` と呼びます。CSS の `transform-origin` とは同じではありません。参照: [PixiJS Positioning]。

<img src="https://aphgames.io/img/docs/tutorials/02-pixi/pos_single_rot_1.svg" alt="回転は原点／ピボットを中心に行われ、デフォルトでは左上隅にあります" width="100%"/>

`pivot` は、オブジェクトの位置のオフセットにも影響します。

<img src="https://aphgames.io/img/docs/tutorials/02-pixi/pos_single_2.svg" alt="ピボットはオブジェクトの位置のオフセットにも影響します" width="100%"/>

```ts
export abstract class Shape {
    get pivot(): ObservablePoint {
        return this.transform.pivot;
    }
    set pivot(value: IPointData) {
        this.transform.pivot.copyFrom(value);
    }
}
```

### 回転 {#rotation}

```ts
export abstract class Shape {
    get rotation(): number {
        return this.transform.rotation;
    }
    set rotation(value: number) {
        this.transform.rotation = value;
    }
}
```

```js eval code=false
circle2 = call(() => {
    const { Circle } = Lesson3;
    const circle = new Circle({
        cx: 0,
        cy: 0,
        r: 50,
        fill: 'red',
    });
    circle.position = { x: 100, y: 100 };
    return circle;
});
```

```js eval code=false
pivotX = Inputs.range([0, 100], { label: 'pivot.x', value: 0, step: 1 });
```

```js eval code=false
pivotY = Inputs.range([0, 100], { label: 'pivot.y', value: 0, step: 1 });
```

```js eval
call(() => {
    circle2.pivot.x = pivotX;
    circle2.pivot.y = pivotY;
});
```

```js eval code=false
(async () => {
    const { Canvas } = Lesson3;
    const canvas = await Utils.createCanvas(Canvas, 200, 200);
    canvas.appendChild(circle2);

    let id;
    const animate = () => {
        circle2.rotation += 0.01;
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });
    return canvas.getDOM();
})();
```

### 拡大縮小 {#scaling}

```ts
export abstract class Shape {
    get scale(): ObservablePoint {
        return this.transform.scale;
    }
    set scale(value: IPointData) {
        this.transform.scale.copyFrom(value);
    }
}
```

```js eval code=false
circle3 = call(() => {
    const { Circle } = Lesson3;
    return new Circle({
        cx: 0,
        cy: 0,
        r: 50,
        fill: 'red',
    });
});
```

```js eval code=false
pivotX2 = Inputs.range([0, 100], { label: 'pivot.x', value: 0, step: 1 });
```

```js eval code=false
pivotY2 = Inputs.range([0, 100], { label: 'pivot.y', value: 0, step: 1 });
```

```js eval code=false
scaleX = Inputs.range([0, 5], { label: 'scale.x', value: 1, step: 0.1 });
```

```js eval code=false
scaleY = Inputs.range([0, 5], { label: 'scale.y', value: 1, step: 0.1 });
```

```js eval
call(() => {
    circle3.pivot.x = pivotX2;
    circle3.pivot.y = pivotY2;
    circle3.scale.x = scaleX;
    circle3.scale.y = scaleY;
    circle3.position.x = 100;
    circle3.position.y = 100;
});
```

```js eval code=false
(async () => {
    const { Canvas } = Lesson3;
    const canvas = await Utils.createCanvas(Canvas, 200, 200);
    canvas.appendChild(circle3);

    let id;
    const animate = () => {
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });
    return canvas.getDOM();
})();
```

### スキュー {#skew}

```ts
export abstract class Shape {
    get skew(): ObservablePoint {
        return this.transform.skew;
    }
    set skew(value: IPointData) {
        this.transform.skew.copyFrom(value);
    }
}
```

## シーングラフ {#scenegraph}

[SceneGraph] は、2D/3D の仮想シーンを組織し管理するためのデータ構造であり、有向非巡回グラフです。シーングラフは、大きく 2 つの機能を提供します。

1. 親子関係を記述します
2. 親子関係に基づいて、一部の複雑なカスケード計算を自動化します

Figma の左パネルには、シーングラフが表示されます。

![Figma のシーングラフ](/scenegraph-figma.png)

次のような階層関係を持つ、簡単な太陽系のシーンを作る必要があると想像してください。

```bash
solarSystem
   |    |
   |   sun
   |
 earthOrbit
   |    |
   |  earth
   |
 moonOrbit
      |
     moon
```

次の API で記述します。`Group` は図形の基底クラスを継承するだけで、レンダリングメソッドをオーバーライドする必要はありません。

```ts
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
```

### 親子関係 {#parent-child-relationships}

図形に `parent` と `children` プロパティを追加します。

```ts
export abstract class Shape {
    parent: Shape;
    readonly children: Shape[] = [];
}
```

次に、`append/removeChild` というノードのメソッドを追加します。子ノードにすでに親ノードが付いている場合は、まずそれを外します。ここでの `_parentID` の設定は [@pixi/math] の実装に関係しており、最後の小節で説明します。

```ts{7}
export abstract class Shape {
  appendChild(child: Shape) {
    if (child.parent) {
      child.parent.removeChild(child);
    }
    child.parent = this;
    child.transform._parentID = -1;
    this.children.push(child);

    return child;
  }
}
```

### シーングラフを走査する {#traverse-scene-graph}

階層ができれば、再帰を使ってシーングラフ全体を走査できます。ここにユーティリティメソッドを追加します。

```ts
export function traverse(shape: Shape, callback: (shape: Shape) => void) {
    callback(shape);
    shape.children.forEach((child) => {
        traverse(child, callback);
    });
}
```

キャンバスのレンダリング中は、上のユーティリティメソッドを使って、各図形を順番にレンダリングします。

```ts{6}
export class Canvas {
  render() {
    const { hooks } = this.#pluginContext;
    hooks.beginFrame.call();
    this.#shapes.forEach((shape) => {
      traverse(shape, (s) => {
        hooks.render.call(s);
      });
    });
    hooks.endFrame.call();
  }
}
```

### 変換を更新する {#update-transform}

シーングラフでは、ワールド座標系における子ノードの変換行列を、次の方法で計算します。

```bash
child's WorldTransform = parent's WorldTransform
    * child's LocalTransform
```

各フレームをレンダリングする前に、変換行列の更新を完了します。

```ts{2}
hooks.render.tap((shape) => {
  shape.transform.updateTransform(
    shape.parent ? shape.parent.transform : IDENTITY_TRANSFORM,
  );
  shape.render(this.#device, this.#renderPass, this.#uniformBuffer);
});
```

図形が変換されていない場合でも、毎フレーム更新する必要があるのか、気になるかもしれません。シーングラフ全体で、すべての図形に対して演算を行う必要があり、オーバーヘッドはかなり大きいからです。このデザインパターンは [第 2 課 - ダーティフラグ](/ja/guide/lesson-002.html#dirty-flag) で紹介しました。ここでは [@pixi/math] の実装を分析しましょう。

変換が起きるたびに、例えば平行移動の変換では、バージョン番号 `_localID` を増やすだけです。

```ts
this.position = new ObservablePoint(this.onChange, this, 0, 0);

protected onChange(): void {
    this._localID++;
}
```

ローカル変換行列を更新するときは、バージョン番号を使って、前回以降に変換が起きていないかを判断します。起きていなければ実際の行列演算は行いません。完了したらバージョン番号を更新し、`_parentID` をリセットして、ワールド変換行列の更新を強制します。

```ts{3}
updateTransform(parentTransform: Transform): void {
    const lt = this.localTransform;
    if (this._localID !== this._currentLocalID) {
        // Perform actual matrix operations
        lt.a = this._cx * this.scale.x;
        // ...
        this._currentLocalID = this._localID;
        this._parentID = -1;
    }
    if (this._parentID !== parentTransform._worldID) {
        this._parentID = parentTransform._worldID;
        this._worldID++;
    }
}
```

先ほど追加した新しい `appendChild` メソッドを覚えていますか。親が変わったので、`_parentID` をリセットする必要があります。こうすると、次の更新が来たときに、ワールド座標系の行列が再計算されます。

```ts{2}
appendChild(child: Shape) {
    child.transform._parentID = -1;
}
```

このパターンは PIXI.js でも、バウンディングボックスの計算のようにオーバーヘッドの大きい演算に使われています。

## さらに読む {#extended-reading}

-   [Scene Graph in Pixi.js]
-   [Scene Graph - LearnOpenGL]
-   [Inside PixiJS: Display objects and their hierarchy]
-   [Understanding 3D matrix transforms]

[CSS Transform]: https://developer.mozilla.org/en-US/docs/Web/CSS/transform
[Transformations - LearnOpenGL]: https://learnopengl.com/Getting-started/Transformations
[@pixi/math]: https://www.npmjs.com/package/@pixi/math
[gl-matrix]: https://github.com/toji/gl-matrix
[Fundamentals of Computer Graphics 4th Edition]: https://www.amazon.com/Fundamentals-Computer-Graphics-Steve-Marschner/dp/1482229390
[SceneGraph]: https://zh.wikipedia.org/zh-cn/%E5%9C%BA%E6%99%AF%E5%9B%BE
[Scene Graph - LearnOpenGL]: https://learnopengl.com/Guest-Articles/2021/Scene/Scene-Graph
[playcanvas]: https://developer.playcanvas.com/en/tutorials/manipulating-entities/
[WebGL 2D Translation]: https://webglfundamentals.org/webgl/lessons/webgl-2d-translation.html
[Memory layout]: https://www.khronos.org/opengl/wiki/Interface_Block_(GLSL)#Memory_layout
[Alignment of Uniform and Storage buffers]: https://sotrh.github.io/learn-wgpu/showcase/alignment/#alignment-of-uniform-and-storage-buffers
[bytemuck]: https://docs.rs/bytemuck/
[bevy]: https://bevyengine.org/
[Inside PixiJS: Display objects and their hierarchy]: https://medium.com/swlh/inside-pixijs-display-objects-and-their-hierarchy-2deef1c01b6e
[Understanding 3D matrix transforms]: https://medium.com/swlh/understanding-3d-matrix-transforms-with-pixijs-c76da3f8bd8
[PixiJS Positioning]: https://aphgames.io/docs/learning/tutorials/pixi_positions
[wgsl-offset-computer]: https://webgpufundamentals.org/webgpu/lessons/resources/wgsl-offset-computer.html#x=5d00000100b900000000000000003d888b0237284d3025f2381bcb288a92bedb79fca10c66815376fc2bf5fb30136b32803636d8a0cd1920b3c155315e5767b430151489cee2b64fbf433be601ac37b5c8a93419775b8ee51571e13b44c1d867e61e8a28bd0e628b80f99570f9d3feafad585f4517807268a20c783cb178401ab49f2e3742419fe1157f8f92396145394a631090a0189fffdc5e4000
[Scene Graph in Pixi.js]: https://pixijs.com/8.x/guides/basics/scene-graph
