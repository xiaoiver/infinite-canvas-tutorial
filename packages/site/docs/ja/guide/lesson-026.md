---
outline: deep
description: '選択ツールを実装します。'
head:
    - ['meta', { property: 'og:title', content: '第26課 - 選択ツール' }]
---

<script setup>
import MultiSelection from '../../components/MultiSelection.vue'
import Lasso from '../../components/Lasso.vue'
</script>

# 第 26 課 - 選択ツール {#lesson-26-selection-tool}

[第 14 課 - 選択モード] では、個々の図形をクリックして選択する単純な機能だけを実装しました。この課では、複数選択、マーキー選択、なげなわを加えて選択ツールをさらに整えます。

## 複数選択 {#multi-selection}

個別クリックによる選択を土台に、<kbd>Shift</kbd> を押したまま、現在の選択へ図形を追加したり外したりできます。

![Figma で <kbd>Shift</kbd> を押しながら複数のレイヤーを選択](https://d33v4339jhl8k0.cloudfront.net/docs/assets/5aa962fe2c7d3a2c4983093d/images/5c8042572c7d3a0cb93253d5/file-TQrRIcwMNR.gif)

選択モードでは、`input.shiftKey` の状態、つまり <kbd>Shift</kbd> が押されているかによって、現在の選択を残すかどうかを決めます。押されていなければ単一選択に切り替え、押されていれば対象の図形を既存の選択へ追加します。

```ts
if (selection.mode === SelectionMode.SELECT) {
    if (layersSelected.length > 1 && layersSelected.includes(selected.id)) {
        // deselect if already selected in a group
        api.deselectNodes([selected]);
    } else {
        api.selectNodes([selected], input.shiftKey); // whether to add to existed selection
    }
}
```

[第 21 課 - トランスフォーマー] では、図形を一つ選択する機能を実装しました。次に、複数の図形が選択された状態を示す Group 表示を追加する必要があります。単一選択のトランスフォーマーと異なり、複数選択の Group は `rotation` と `scale` を考慮しなくてよいです。

```ts
export class RenderTransformer extends System {
    getOBB(camera: Entity): OBB {
        const { selecteds } = camera.read(Transformable);

        // Single selected, keep the original OBB include rotation & scale.
        if (selecteds.length === 1 && selecteds[0].has(ComputedBounds)) {
            const { obb } = selecteds[0].read(ComputedBounds);
            return obb;
        }

        // [!code ++]
        if (selecteds.length > 1) {
            // [!code ++]
        }
    }
}
```

効果は次のとおりです。リサイズ時に選択したすべての図形を変換するロジックは [第 21 課 - 図形の変換] で既に紹介したので、ここでは繰り返しません。

<MultiSelection />

## マーキー選択 {#marquee-selection}

次の図は [Select layers and objects in Figma] からのものです。

![Figma の選択マーキー](https://d33v4339jhl8k0.cloudfront.net/docs/assets/5aa962fe2c7d3a2c4983093d/images/5c8042ec04286350d088ba04/file-tAFIn9Cimd.gif)

このマーキー選択ツールは “marquee” と呼ばれます。参照: [Make selections with the Rectangular Marquee tool]。形成された矩形領域をブラシ（Brush）と呼びます。

マーキー選択が終わるとき（マウスボタンを離したとき）、まずブラシの矩形を隠す必要があります。実装は次の節で見ます。そのあと、[第 8 課 - 空間インデックスによる高速化] で紹介した高速なピッキングを使います。矩形の幅と高さが負になることがあるため（ドラッグ方向によります）、BBox が有効になるよう計算が必要である点に注意してください。

```ts
if (input.pointerUpTrigger) {
    if (selection.mode === SelectionMode.BRUSH) {
        // Hide Brush...

        if (selection.brush) {
            const { x, y, width, height } = selection.brush.read(Rect);
            // Make a valid BBox
            const minX = Math.min(x, x + width);
            const minY = Math.min(y, y + height);
            const maxX = Math.max(x, x + width);
            const maxY = Math.max(y, y + height);
            const selecteds = api
                .elementsFromBBox(minX, minY, maxX, maxY) // Use space index
                .filter((e) => !e.has(UI))
                .map((e) => api.getNodeByEntity(e));
            api.selectNodes(selecteds); // Finish selection
        }
    }
}
```

マーキー選択の途中でも、ハイライトとトランスフォーマーで選択状態をリアルタイムに示したいと考えています。上のピッキングと選択のロジックを土台に、ハイライトを追加します。

![ブラシ中のハイライト](/brush.gif)

```ts
api.selectNodes(selecteds);
// [!code ++]
if (needHighlight) {
    api.highlightNodes(selecteds); // [!code ++]
}
```

もちろん、ビューポート空間内のコンポーネントは SVG でも実装でき、続くなげなわツールでその例を見ます。

## Esc で選択解除 {#deselect-with-esc}

選択状態で <kbd>Esc</kbd> を押すと選択が解除されます。また、マーキー選択の途中ではブラシを隠す必要があります。

```ts
if (input.key === 'Escape') {
    api.selectNodes([]);
    if (selection.mode === SelectionMode.BRUSH) {
        this.hideBrush(selection);
    }
}
```

## レイヤーのロックとロック解除 {#lock-and-unlock-layers}

ロックされたレイヤーは選択できません。詳細は [Lock and unlock layers] を参照してください。

## なげなわ選択 {#lasso-selection}

矩形マーキーツールと比べて、なげなわツールは不規則な多角形を作ることで、より精密な選択ができます。

-   [Feature Request: Lasso Selection (free selection) in Excalidraw]
-   [lasso-tool-figma]

AI ベースの画像編集では、なげなわツールでより精密にマスクを作り、インペインティングを行うこともできます。下の図は Figma での効果で、選択した領域は消去したり、レイヤーへ分離したりできます。

![出典: https://help.figma.com/hc/en-us/articles/24004542669463-Make-or-edit-an-image-with-AI#h_01KBJQAF0G6X98H5JJ8GBAPTGP](https://help.figma.com/hc/article_attachments/36912285044247)

### なげなわを描く {#draw-lasso}

[第 25 課 - 鉛筆ツール] では、ポリラインのパスを自由に描く方法を扱いました。SVG コンテナの中でなげなわのパスを描き続け、通常はアニメーション効果（アリの行進）のある破線で表します。

```html
<path d="...">
    <animate
        attribute-name="stroke-dashoffset"
        stroke-dasharray="7 7"
        stroke-dashoffset="10"
        from="0"
        to="-14"
        dur="0.3s"
    />
</path>
```

まず、点の座標をビューポート座標系からキャンバス座標系へ変換します。次に、現在のカメラのズームレベルに応じてパスを単純化します。ズームレベルが高ければより細かい選択粒度が必要で、低ければその逆です。また、頂点が少ないほど、レンダリング性能とその後の交差判定の効率がどちらも上がります。

```ts
import simplify from 'simplify-js';

const lassoPath = super
    .getCurrentTrail()
    ?.originalPoints?.map(([x, y]) => this.api.viewport2Canvas({ x, y }));

const simplifyDistance = 5 / this.api.getAppState().cameraZoom;
const points = simplify(lassoPath, simplifyDistance).map((p) => [p.x, p.y]);
// Hit-test the current path as it changes for preview, and again on pointerup
// before clearing the trail to commit the final selection.
const selected = selectByLassoPath(this.api, points);
```

<Lasso />

図形の周りをドラッグすると、ヒットがすぐにプレビューされます。なげなわが変わると輪郭線が表示されたり消えたりします。未完成のなげなわは、ヒットテストのために始点へ自動的に閉じられます。離すと、最終的な選択が 1 回の元に戻す操作として確定します。Escape を押す、タッチジェスチャを取り消す、ピンチを始める、またはツールを切り替えると、選択せずにプレビューが消えます。タップやごく小さな動きでは何も選択されません。もう一度選択するには、なげなわツールを選び直します。マスク描画モードは離したときにだけパスを作り、図形選択のプレビューは行いません。

ヒットテストはワールド座標を使い、各図形の親の変換、回転、反転を含みます。開いたポリラインは、暗黙の閉じ辺を足さず、区間ごとに判定します。ロックされた図形と非表示の図形は除外されます。

### 多角形の交差判定 {#polygon-intersection}

Path を作ったので、シーンの中でそれと交差するジオメトリを取得する必要があります。これまでどおり、[第 8 課 - 空間インデックスによる高速化] から使い始めます。

```ts
function selectByLassoPath(api: API, lassoPath: [number, number][]) {
    const lassoBounds = lassoPath.reduce(
        (acc, item) => {
            return [
                Math.min(acc[0], item[0]),
                Math.min(acc[1], item[1]),
                Math.max(acc[2], item[0]),
                Math.max(acc[3], item[1]),
            ];
        },
        [Infinity, Infinity, -Infinity, -Infinity],
    ) as [number, number, number, number];

    // Hit-test with rbush
    const elements = api.elementsFromBBox(
        lassoBounds[0],
        lassoBounds[1],
        lassoBounds[2],
        lassoBounds[3],
    );

    // elementsFromBBox excludes locked elements; also filter UI and hidden nodes.
}
```

高速なバウンディングボックス判定を通過したあと、二つの場合を処理しなければなりません。なげなわが図形の内部に完全に含まれる場合と、なげなわが図形と交差する場合です。

```ts
function isPolygonsIntersect(points1: number[][], points2: number[][]) {
    let isIn = false;
    // Determine whether a point lies inside a polygon. If any point is inside another polygon, return true.
    points2.forEach((point) => {
        if (isPointInPolygon(points1, point[0], point[1])) {
            isIn = true;
            return false;
        }
    });
    if (isIn) {
        return true;
    }
}
```

## さらに読む {#extended-reading}

-   [How do I determine if two convex polygons intersect?]

[第 14 課 - 選択モード]: /ja/guide/lesson-014#select-mode
[第 21 課 - トランスフォーマー]: /ja/guide/lesson-021
[第 21 課 - 図形の変換]: /ja/guide/lesson-021#transform-shape
[Select layers and objects in Figma]: https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects
[Make selections with the Rectangular Marquee tool]: https://helpx.adobe.com/photoshop/using/tool-techniques/rectangular-marquee-tool.html
[第 8 課 - 空間インデックスによる高速化]: /ja/guide/lesson-008#using-spatial-indexing
[lasso-tool-figma]: https://github.com/kernel-picnic/lasso-tool-figma
[Feature Request: Lasso Selection (free selection) in Excalidraw]: https://github.com/excalidraw/excalidraw/issues/6350
[第 25 課 - 鉛筆ツール]: /ja/guide/lesson-025#pencil-tool
[How do I determine if two convex polygons intersect?]: https://stackoverflow.com/questions/753140/how-do-i-determine-if-two-convex-polygons-intersect
[Lock and unlock layers]: https://help.figma.com/hc/en-us/articles/360041596573-Lock-and-unlock-layers
