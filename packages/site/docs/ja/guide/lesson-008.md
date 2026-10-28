---
outline: deep
description: 'ドローコールを理解し、ビューポートカリング、ドローコールのバッチング、ピッキングのための空間インデックス、GPU ベースの色ピッキングを実装して、レンダリング性能を最適化します。'
head:
    - [
          'meta',
          { property: 'og:title', content: '第8課 - パフォーマンス最適化' },
      ]
---

# 第 8 課 - パフォーマンス最適化 {#lesson-8-optimize-performance}

この課では、次の内容を学びます。

-   ドローコールとは何か
-   カリングでドローコールを減らす
-   バッチをまとめてドローコールを減らす
-   空間インデックスでピッキング効率を高める
-   GPU ベースの色ピッキング

パフォーマンス最適化は複雑で長期にわたる作業であり、私はプロジェクトの早い段階でこの作業に力を入れることが多いです。先ほど SDF で円を描く方法を学びました。ここで性能テストとして円を 1000 個描くと、FPS はおよそ 35 になります。

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas-lesson7');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson7;

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

        for (let i = 0; i < 100; i++) {
            const circle = new Circle({
                cx: Math.random() * 400,
                cy: Math.random() * 200,
                r: Math.random() * 20,
                fill: 'red',
            });
            canvas.appendChild(circle);
        }
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

FPS を測るために [stats.js] を使い、キャンバスの左上に置くパネルを作ります。現状では明らかに滑らかではありません。

```ts
const stats = new Stats();
stats.showPanel(0); // Only show FPS panel

const animate = () => {
    // Trigger updating
    if (stats) {
        stats.update();
    }
    canvas.render();
    requestAnimationFrame(animate);
};
```

第 1 課で紹介した [Spector.js] を使うと、描画コマンドが非常に多いことがわかります。`drawElements` コマンドだけに絞り込んでみると、実際には円 1 つが複数の WebGL コマンド（バッファの作成などを含む）に対応しています。

![Spector.js のドローコール](/draw-calls.png)

## ドローコールとは {#draw-call}

これらの描画コマンドをドローコール（Draw call）と呼びます。次の図は [Draw calls in a nutshell] からのもので、ドローコールの数が増えると性能に影響する理由を説明しています。ドローコールはすべて CPU から発行されるため、数が増えるほど CPU の準備時間が長くなります。GPU は描画自体は速いものの待たされ、空き時間が多くなります。つまりボトルネックは CPU にあります。

![CPU と GPU のドローコール](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*EEqn28cbO11QXkyqcoaO7g.jpeg)

では、ドローコールを減らすにはどうすればよいでしょうか。考え方は通常次の 2 つです。

-   ビューポートカリング。
-   ドローコールのバッチング。

## ビューポートカリング {#culling}

ビューポートの外にある図形は描画する必要がありません。下の図は Unreal の [How Culling Works] からのもので、神の視点から、カメラのビューフラスタム（視錐）の外にあってカリングされた赤いオブジェクトを示しています。不要なドローコールが大きく減ることがわかります。

![ビューフラスタムカリング](https://d1iv7db44yhgxn.cloudfront.net/documentation/images/6f2a0e24-c0e0-4fc0-b637-29c792739474/sceneview_viewfrustumculled.png)

3D シーンには、カメラのビューフラスタムに基づくカリングアルゴリズムの最適化が数多くあります。[Efficient View Frustum Culling] で説明されているように、シーングラフの情報を使う方法もあります。ある図形がすでにビューフラスタムの内側に完全に入っていれば、その子ノードは調べなくて済みます。

レンダリングエンジンにも対応する機能があります。たとえば次のとおりです。

-   Cesium [Fast Hierarchical Culling]
-   Babylon.js [Changing Mesh Culling Strategy]
-   [pixi-cull]

3D シーンに比べると、私たちの 2D キャンバスは実装がずっと単純です。では、図形がビューポート内にあるかどうかは、どう判定すればよいでしょうか。ここでバウンディングボックスの考え方が必要になります。もちろんバウンディングボックスの代わりに、3D シーンではバウンディングスフィアを使うこともできます。

### 軸平行バウンディングボックス {#aabb}

軸平行バウンディングボックス（Axis-Aligned Bounding Box、略して AABB）は、3D グラフィックスでよく使われる単純なバウンディングボックスで、ワールド座標系の軸に平行です。言い換えると、辺の向きが座標軸と同じです。軸平行バウンディングボックスは通常は直方体で、物体ひとつ、または物体の集まりが空間内で占める領域を、単純化した箱で表します。私たちの 2D シーンでは長方形になり、左上の `minX/Y` と右下の `maxX/Y` だけを保存すれば十分です。

```ts
export class AABB {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    matrix: Matrix;

    isEmpty() {
        return this.minX > this.maxX || this.minY > this.maxY;
    }
}
```

次に、図形のバウンディングボックスを求める方法を追加します。円を例にすると、中心、半径、線幅を考慮します。ここでは [ダーティフラグ][Dirty flag] を使い、関連する属性が変わったときだけ再計算します。

```ts
export class Circle extends Shape {
    getRenderBounds() {
        if (this.renderBoundsDirtyFlag) {
            const halfLineWidth = this.#strokeWidth / 2;
            this.renderBoundsDirtyFlag = false;
            this.renderBounds = new AABB(
                this.#cx - this.#r - halfLineWidth,
                this.#cy - this.#r - halfLineWidth,
                this.#cx + this.#r + halfLineWidth,
                this.#cy + this.#r + halfLineWidth,
            );
        }
        return this.renderBounds;
    }
}
```

### カリングプラグインを追加する {#culling-plugin}

カリングプラグインを追加します。このプラグインはビューポートに対応するバウンディングボックスを保存し、その後それぞれの図形のバウンディングボックスと交差判定します。カメラの変換を考慮して、ワールド座標系におけるビューポートの 4 頂点の座標を求め、それらをバウンディングボックスで囲みます。カメラが変わるたびに、このバウンディングボックスを更新します。

```ts
export class Culling implements Plugin {
    #viewport: AABB = new AABB();

    private updateViewport() {
        const {
            camera,
            api: { viewport2Canvas },
        } = this.#context;
        const { width, height } = camera;

        // tl, tr, br, bl
        const tl = viewport2Canvas({
            x: 0,
            y: 0,
        });

        this.#viewport.minX = Math.min(tl.x, tr.x, br.x, bl.x);
        this.#viewport.minY = Math.min(tl.y, tr.y, br.y, bl.y);
        this.#viewport.maxX = Math.max(tl.x, tr.x, br.x, bl.x);
        this.#viewport.maxY = Math.max(tl.y, tr.y, br.y, bl.y);
    }
}
```

各フレームの開始時にシーングラフを走査し、図形のバウンディングボックスがビューポートと交差するかを判定します。交差しなければ `culled` を `true` にして、レンダリング時にスキップできるようにします。

```ts
hooks.beginFrame.tap(() => {
    const { minX, minY, maxX, maxY } = this.#viewport;

    traverse(root, (shape) => {
        if (shape.renderable && shape.cullable) {
            const bounds = shape.getBounds();
            shape.culled =
                bounds.minX >= maxX ||
                bounds.minY >= maxY ||
                bounds.maxX <= minX ||
                bounds.maxY <= minY;
        }

        return shape.culled;
    });
});
```

効果を見ると、拡大・縮小に合わせて除外された図形の数が変わり、除外された図形が多いほど FPS は高くなります。

```js eval code=false
$total = call(() => {
    return document.createElement('div');
});
```

```js eval code=false
$culled = call(() => {
    return document.createElement('div');
});
```

```js eval code=false
$icCanvas2 = call(() => {
    return document.createElement('ic-canvas-lesson8');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson8;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas2.parentElement.style.position = 'relative';
    $icCanvas2.parentElement.appendChild($stats);

    const circles = [];
    $icCanvas2.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        for (let i = 0; i < 500; i++) {
            const circle = new Circle({
                cx: Math.random() * 1000,
                cy: Math.random() * 1000,
                r: Math.random() * 20,
                fill: `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
                    Math.random() * 255,
                )},${Math.floor(Math.random() * 255)})`,
                batchable: false,
                // cullable: false,
            });
            canvas.appendChild(circle);
            circles.push(circle);
        }
    });

    $icCanvas2.addEventListener('ic-frame', (e) => {
        stats.update();
        const total = circles.length;
        const culled = circles.filter((circle) => circle.culled).length;

        $total.innerHTML = `total: ${total}`;
        $culled.innerHTML = `culled: ${culled}`;
    });
});
```

ビューポートがすべての図形を含んでいると、どの図形も除外できないので、別の手段でドローコールを減らす必要があります。

## バッチレンダリング {#batch-rendering}

まとめられるドローコールには、似たジオメトリを持つ、同じシェーダーを使う、といった条件が必要です。[Draw call batching - Unity] では 2 つの方法が示されています。

-   [Static batching] 静止しているオブジェクト向けです。ワールド座標系へ変換し、共有の頂点配列を使います。一度処理すると、個々のオブジェクトに変換を適用できなくなります。
-   [Dynamic batching] 動くオブジェクト向けです。CPU 側で頂点をワールド座標系へ変換しますが、変換そのものにコストがあります。

Pixi.js にもバッチレンダリングシステムが組み込まれており、現在開発中の V8 まで使われています。[Inside PixiJS: Batch Rendering System]。

まずレンダリングのロジックを図形から分離します。図形は、自分がどのように描かれるかを気にしなくてよいはずです。

```ts
class Circle {
    render(device: Device, renderPass: RenderPass, uniformBuffer: Buffer) {} // [!code --]
}
```

以前はシーングラフを走査しながら、図形のレンダリングロジックをすぐに実行していました。今は図形を描画待ちのキューに追加し、まとめてから一緒に出力されるのを待ちます。

```ts
hooks.render.tap((shape) => {
    shape.render(); // [!code --]
    if (shape.renderable) {
        this.#batchManager.add(shape); // [!code ++]
    }
});
```

続いて Drawcall クラスを抽象化し、これまでに実装した SDF がそれを継承するようにします。このクラスには次のライフサイクルがあります。

```ts
export abstract class Drawcall {
    abstract createGeometry(): void;
    abstract createMaterial(uniformBuffer: Buffer): void;
    abstract render(renderPass: RenderPass): void;
    abstract destroy(): void;
}

export class SDF extends Drawcall {}
```

### インスタンシング {#instanced}

似た図形が多数あるときは、[WebGL2 Optimization - Instanced Drawing] によってドローコールの数を大きく減らせます。Three.js ではこれを [InstancedMesh] と呼びます。Babylon.js にも [Instances] があり、変換行列や色のようにインスタンスごとに異なる属性は、頂点配列として渡せます。

![インスタンスのノード](https://doc.babylonjs.com/img/how_to/instances-node.png)

```glsl
#ifdef INSTANCES
  attribute vec4 world0;
  attribute vec4 world1;
  attribute vec4 world2;
  attribute vec4 world3;

  finalWorld = mat4(world0, world1, world2, world3);
#endif
```

2D シーンだけを扱うので、変換行列は 6 成分だけ保存すれば足ります。

```glsl
#ifdef USE_INSTANCES
  layout(location = 14) in vec4 a_Abcd;
  layout(location = 15) in vec2 a_Txty;

  model = mat3(a_Abcd.x, a_Abcd.y, 0, a_Abcd.z, a_Abcd.w, 0, a_Txty.x, a_Txty.y, 1);
#endif
```

付け加えると、個々のインスタンスの変換行列は頂点データに直接入れるほか、データテクスチャに保存し、頂点配列のインデックスから参照することもできます。
[Drawing Many different models in a single draw call]

Drawcall に `instanced` フラグを追加します。

```ts
export abstract class Drawcall {
    constructor(protected device: Device, protected instanced: boolean) {}
}
```

このフラグに応じて、シェーダーのヘッダに `define` プリプロセッサディレクティブを追加します。

```ts{5}
export class SDF extends Drawcall {
  createMaterial(uniformBuffer: Buffer): void {
    let defines = '';
    if (this.instanced) {
      defines += '#define USE_INSTANCES\n';
    }
  }
}
```

こうすると、モデル変換行列を attribute または uniform から計算できます。

```glsl
void main() {
  mat3 model;
  #ifdef USE_INSTANCES
    model = mat3(a_Abcd.x, a_Abcd.y, 0, a_Abcd.z, a_Abcd.w, 0, a_Txty.x, a_Txty.y, 1);
  #else
    model = u_ModelMatrix;
  #endif
}
```

ここまで来ると [Spector.js] で確認でき、ビューポート内に円が 1000 個あっても、ドローコール 1 回で描けます。

![Spector.js のインスタンシングドローコール](/instanced-spector.png)

1 つの Drawcall に含めるインスタンスの最大数も制限できます。作る前に毎回検査し、上限を超えていたら作り直します。

```ts
export abstract class Drawcall {
    protected maxInstances = Infinity;
    validate() {
        return this.count() <= this.maxInstances - 1;
    }
}
```

### 描画順序 {#rendering-order}

1 回のドローコールで複数の図形を描くので、描画順に注意が必要です。インスタンス配列の中での各要素の位置が、最終的な描画順と一致するとは限りません。そのため、実際に描く前に図形ごとに値を割り当て、その値を `[0, 1]` に正規化してから、深度値としてシェーダーに渡します。

```ts{4}
export class Renderer implements Plugin {
  apply(context: PluginContext) {
    hooks.render.tap((shape) => {
      shape.globalRenderOrder = this.#zIndexCounter++;
    });

    hooks.beginFrame.tap(() => {
      this.#zIndexCounter = 0;
    });
  }
}
```

続いて [Depth testing] を有効にします。テスト方法は次のように変えます。深度値が、現在の Depth buffer に格納されている値（範囲は `[0, 1]`）より大きければ書き込みます。WebGL の既定値は `gl.LESS` です。このシーンでは、ZIndex が大きい図形が小さい図形を上書きします。

```ts
export class SDF extends Drawcall {
    createMaterial(uniformBuffer: Buffer): void {
        this.#pipeline = this.device.createRenderPipeline({
            megaStateDescriptor: {
                depthWrite: true, // [!code ++]
                depthCompare: CompareFunction.GREATER, // [!code ++]
            },
        });
    }
}
```

最後に、RenderPass を作るとき Depth RenderTarget を追加で作ります。

```ts
this.#renderPass = this.#device.createRenderPass({
    colorAttachment: [this.#renderTarget],
    colorResolveTo: [onscreenTexture],
    colorClearColor: [TransparentWhite],
    depthStencilAttachment: this.#depthRenderTarget, // [!code ++]
    depthClearValue: 1, // [!code ++]
});
```

動作を確認します。カリングとバッチの最適化を同時に有効にして、円を 5000 個描きます。

```js eval code=false
$icCanvas3 = call(() => {
    return document.createElement('ic-canvas-lesson8');
});
```

```js eval code=false
$total2 = call(() => {
    return document.createElement('div');
});
```

```js eval code=false
$culled2 = call(() => {
    return document.createElement('div');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson8;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas3.parentElement.style.position = 'relative';
    $icCanvas3.parentElement.appendChild($stats);

    const circles = [];
    $icCanvas3.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        for (let i = 0; i < 5000; i++) {
            const circle = new Circle({
                cx: Math.random() * 1000,
                cy: Math.random() * 1000,
                r: Math.random() * 20,
                fill: `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
                    Math.random() * 255,
                )},${Math.floor(Math.random() * 255)})`,
                batchable: true,
                cullable: true,
            });
            canvas.appendChild(circle);
            circles.push(circle);
        }
    });

    $icCanvas3.addEventListener('ic-frame', (e) => {
        stats.update();
        const total = circles.length;
        const culled = circles.filter((circle) => circle.culled).length;

        $total2.innerHTML = `total: ${total}`;
        $culled2.innerHTML = `culled: ${culled}`;
    });
});
```

### カリングを無効にする {#disable-culling}

カリングを有効にすると、状況によってはかえって性能上の負担が増えることがあります。

[Wikipedia Datamap]

## ピッキング性能の最適化 {#optimizing-picking-perf}

次に、各 Circle へ pointerenter/leave のイベントリスナーを付けて、ピッキング性能を測ります。

```ts
circle.addEventListener('pointerenter', () => {
    circle.fill = 'red';
});
circle.addEventListener('pointerleave', () => {
    circle.fill = fill;
});
```

Circle 20000 個のピッキングにかかった時間は次のとおりです。

![ピッキング性能](/pick-perf.png)

図形の AABB はビューポートに基づくカリングに使え、数学的な方法よりも速く近似判定できます。

### 空間インデックスを使う {#using-spatial-indexing}

空間インデックス（Spatial Index）は、空間データと検索操作を効率よく扱うためのデータ構造で、地理情報システム（GIS）、コンピュータグラフィックス、3D ゲーム開発、データベース技術で特によく使われます。空間インデックスの主な目的は、大量のデータの中から特定の空間オブジェクトを探すときに必要な計算量と時間を減らすことです。空間インデックスにはクアッドツリー（Quadtree）、オクツリー（Octree）、R ツリー（R-tree）、K-d ツリー（K-d tree）などさまざまなデータ構造があり、それぞれに向いた用途と長所があります。

PIXI.js のエコシステムには、フレームごとに新しい空間インデックスを作る [pixi-spatial-hash] のようなライブラリがあります。ただし、現時点ではメンテナンスが不足しているようです。

一括挿入に対応した [rbush] を使います。一括挿入は、通常、1 件ずつ挿入するより 2〜3 倍速く、mapbox でも使われています。

```ts
import RBush from 'rbush';
const rBushRoot = new RBush<RBushNodeAABB>();

export interface RBushNodeAABB {
    shape: Shape;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}
```

### RBush の検索 {#rbush-search}

RBush は領域検索の関数 [search] を提供します。検索ボックスを渡すと、ヒットした図形の一覧を返します。

```ts
export class Canvas {
    elementsFromBBox(
        minX: number,
        minY: number,
        maxX: number,
        maxY: number,
    ): Shape[] {
        const { rBushRoot } = this.#pluginContext;
        const rBushNodes = rBushRoot.search({ minX, minY, maxX, maxY });

        const hitTestList: Shape[] = [];
        rBushNodes.forEach(({ shape }) => {
            // Omit the process of handling the visibility and pointerEvents properties of shape.
        });
        // Sort by global render order.
        hitTestList.sort((a, b) => a.globalRenderOrder - b.globalRenderOrder);

        return hitTestList;
    }
}
```

[ピッキングプラグイン][picking plugin] では、上の領域検索を使います。もちろん渡すのは AABB ではなく点です。

```ts{9}
export class Picker implements Plugin {
  apply(context: PluginContext) {
    hooks.pickSync.tap((result: PickingResult) => {
      const {
        position: { x, y },
      } = result;

      const picked: Shape[] = [root];
      elementsFromBBox(x, y, x, y).forEach((shape) => {
        if (this.hitTest(shape, x, y)) {
          picked.unshift(shape);
        }
      });
      result.picked = picked;
      return result;
    });
  }
}
```

測り直すと、Circle 20,000 個のピッキング時間は 0.088ms になり、およそ 20 倍改善します。

![rbush を使ったピッキング性能](/pick-rbush-perf.png)

### GPU ベースの色ピッキング {#color-picking}

前の [ピッキング][Picking] の節で、数学に基づくピッキングの代替として GPU ベースの色ピッキングに触れました。deck.gl ではこれを [Color Picking] と呼びます。

## さらに読む {#extended-reading}

-   [Inside PixiJS: Batch Rendering System]
-   [Depth testing]
-   [The Depth Texture | WebGPU]
-   Three.js [BatchedMesh: Proposal]

[stats.js]: https://github.com/mrdoob/stats.js
[Spector.js]: https://spector.babylonjs.com/
[Draw calls in a nutshell]: https://toncijukic.medium.com/draw-calls-in-a-nutshell-597330a85381
[Draw call batching - Unity]: https://docs.unity3d.com/Manual/DrawCallBatching.html
[Static batching]: https://docs.unity3d.com/Manual/static-batching.html
[Dynamic batching]: https://docs.unity3d.com/Manual/dynamic-batching.html
[pixi-cull]: https://github.com/davidfig/pixi-cull
[pixi-spatial-hash]: https://github.com/ShukantPal/pixi-spatial-hash
[rbush]: https://github.com/mourner/rbush
[How Culling Works]: https://dev.epicgames.com/documentation/en-us/unreal-engine/visibility-and-occlusion-culling-in-unreal-engine#howcullingworks
[Efficient View Frustum Culling]: https://old.cescg.org/CESCG-2002/DSykoraJJelinek/
[Fast Hierarchical Culling]: https://cesium.com/blog/2015/08/04/fast-hierarchical-culling/
[Changing Mesh Culling Strategy]: https://doc.babylonjs.com/features/featuresDeepDive/scene/optimize_your_scene#changing-mesh-culling-strategy
[Inside PixiJS: Batch Rendering System]: https://medium.com/swlh/inside-pixijs-batch-rendering-system-fad1b466c420
[BatchedMesh: Proposal]: https://github.com/mrdoob/three.js/issues/22376
[InstancedMesh]: https://threejs.org/docs/?q=instanced#api/en/objects/InstancedMesh
[WebGL2 Optimization - Instanced Drawing]: https://webgl2fundamentals.org/webgl/lessons/webgl-instanced-drawing.html
[Drawing Many different models in a single draw call]: https://webglfundamentals.org/webgl/lessons/webgl-qna-drawing-many-different-models-in-a-single-draw-call.html
[Instances]: https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/instances
[Dirty flag]: /ja/guide/lesson-002#dirty-flag
[Depth testing]: https://learnopengl.com/Advanced-OpenGL/Depth-testing
[The Depth Texture | WebGPU]: https://carmencincotti.com/2022-06-13/webgpu-the-depth-texture/
[picking plugin]: /ja/guide/lesson-006#picking-plugin
[search]: https://github.com/mourner/rbush?tab=readme-ov-file#search
[Picking]: /ja/guide/lesson-006#picking
[Color Picking]: https://deck.gl/docs/developer-guide/custom-layers/picking
[Wikipedia Datamap]: /example/wikipedia-datamap
