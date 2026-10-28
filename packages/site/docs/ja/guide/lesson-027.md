---
outline: deep
description: 'スナップと整列'
head:
    - ['meta', { property: 'og:title', content: '第27課 - スナップと整列' }]
---

<script setup>
import SnapToPixelGrid from '../../components/SnapToPixelGrid.vue'
import SnapToObjects from '../../components/SnapToObjects.vue'
</script>

# 第 27 課 - スナップと整列 {#lesson-27-snap-and-align}

スナップは、グラフィックエディタのアプリケーションでよくある機能です。中心となる考え方は、要素を移動、描画、拡大縮小するときに、要素の境界やアンカーポイントを、最も近いピクセルグリッドの線や他のグラフィックへ自動的に揃えることです。この課では、その実装を紹介します。

## ピクセルグリッドへのスナップ {#snap-to-pixel-grid}

[第 5 課 - グリッドを描く] では、直線のグリッドを効率よく描く方法を紹介しました。移動や描画のような一部のドラッグ操作で、グリッドの最小単位へスナップすると、グラフィックの位置や幾何情報が整数になります。この機能は Figma で "Snap to pixel grid" と呼ばれ、「ユーザー環境設定」で有効にできます。

![ピクセルグリッドへのスナップ](https://user-images.githubusercontent.com/490574/85198268-4ff5f300-b322-11ea-897e-602ef5936995.gif)

出典: [Snap to grid in Excalidraw]。

```ts
export interface AppState {
    snapToPixelGridEnabled: boolean; // [!code ++]
    snapToPixelGridSize: number; // [!code ++]
}
```

この機能を実装するには、まずワールド座標系における点の座標を計算する必要があります。ユーザーがグラフィックをドラッグ、拡大縮小、描画するとき、現在の座標（たとえば x、y）を取得し、その座標を最も近い整数（ピクセル点）、または指定したグリッド間隔へ丸めます。

```ts
// Snap to custom grid (e.g. 10px)
function snapToGrid(value, gridSize = 10) {
    return Math.round(value / gridSize) * gridSize;
}
```

そのあと、ワールド座標系で点の座標を計算する必要があるすべての System（たとえば Select、DrawRect）に、この処理関数を適用します。

```ts
let { x: sx, y: sy } = api.viewport2Canvas({
    x: prevX,
    y: prevY,
});
let { x: ex, y: ey } = api.viewport2Canvas({
    x,
    y,
});
const { snapToPixelGridEnabled, snapToPixelGridSize } = api.getAppState(); // [!code ++]
// [!code ++]
if (snapToPixelGridEnabled) {
    // [!code ++]
    sx = snapToGrid(sx, snapToPixelGridSize);
    // [!code ++]
    sy = snapToGrid(sy, snapToPixelGridSize);
    // [!code ++]
    ex = snapToGrid(ex, snapToPixelGridSize);
    // [!code ++]
    ey = snapToGrid(ey, snapToPixelGridSize);
    // [!code ++]
}
```

下の例では `snapToPixelGridSize` を 10 に設定しています。ドラッグ、移動、描画で効果を確認できます。

<SnapToPixelGrid />

## オブジェクトレベルのスナップ {#snap-to-objects}

Excalidraw におけるスナップ機能の実装は、次の主要な手順に分かれます。

-   現在の操作がスナップを許可するかを確認します（[isSnappingEnabled]）。
-   スナップ可能なすべての点とギャップを計算します（[getPointSnaps]）。
-   ドラッグ／拡大縮小の最中に、スナップのオフセットとガイド線をリアルタイムで計算します（[snapDraggedElements] / [snapResizingElements]）。
-   snapLines を UI レイヤーへ渡し、キャンバス上にガイド線を描画します（[renderSnaps]）。

以下では、上に示した手順に沿って実装します。

オブジェクトスナップはピクセルグリッドとは独立して動作します。`snapToObjectsDistance` は CSS ピクセル単位の半径なので、ズームしても体感上の吸着距離は変わりません。移動中は、ポインターを押した時点の形状と、加工前のポインター変位から候補位置を計算し、スナップは表示位置にだけ適用します。スナップ後の位置を次のサンプルに戻すと、オブジェクトはガイドへ引き戻され続けます。

移動では、バウンディングボックスの辺と中心の整列、および等間隔ガイドをサポートします。リサイズでは、動いている辺や角を他のオブジェクトの辺と中心にスナップしつつ、反対側の辺、縦横比の制約、中心を基準にした拡大縮小を維持します。回転したオブジェクトでは、動いているハンドルをワールド座標で揃えます。参照からは、非表示のオブジェクト、画面外のオブジェクト、選択範囲の祖先と子孫を除外します。これらが現在実装されている動作です。リサイズ中の間隔配分、同じサイズへの一致、描画中のスナップは今後の作業として残っているため、これは Figma の動作すべてと同じ水準ではありません。

### スナップが有効か {#is-snapping-enabled}

アプリケーション設定に次の構成オプションを追加しました。「環境設定メニュー」でも有効にできます。

```ts
export interface AppState {
    snapToObjectsEnabled: boolean; // [!code ++]
}
```

選択した図形を移動またはリサイズするときにトリガーされます。

![出典: https://github.com/excalidraw/excalidraw/issues/263#issuecomment-577605528](https://user-images.githubusercontent.com/5153846/72973602-d804ba80-3dcd-11ea-9717-05448160044c.gif)

### ポイントスナップの取得 {#get-point-snaps}

スナップ点は二つの種類に分かれます。選択された図形と、それ以外の図形です。選択された図形が一つまたは複数のとき、よく使うスナップ点にはバウンディングボックスの四隅と中心が含まれます。

```ts
const { minX, minY, maxX, maxY } = api.getGeometryBounds(
    elements.map((id) => api.getNodeById(id)),
);
const boundsWidth = maxX - minX;
const boundsHeight = maxY - minY;
return [
    [minX, minY], // corners
    [maxX, minY],
    [minX, maxY],
    [maxX, maxY],
    [minX + boundsWidth / 2, minY + boundsHeight / 2], // center
] as [number, number][];
```

性能を考えると、選択された図形の吸着点を、他のすべての図形に対して検出する回数はできるだけ減らすべきです。似た問題は [第 8 課 - 空間インデックスを使う] で既に扱っており、ビューポート内の図形だけを取得します。

```ts
const unculledAndUnselected = api
    .getNodes()
    .map((node) => api.getEntity(node))
    .filter((entity) => !entity.has(Culled) && !entity.has(Selected));
```

同様に、これらの図形の参照点を計算します。

```ts
const referenceSnapPoints: [number, number][] = unculledAndUnselected
    .map((entity) => getElementsCorners(api, [api.getNodeByEntity(entity).id]))
    .flat();
```

次に、選択された図形のスナップ点を、他の図形のスナップ点と一つずつ比較します。水平方向または垂直方向でより近い点の組を見つけ、両者の距離の差を、その後のスナップ距離として記録します。

```ts
nearestSnapsX.push({
    type: 'point',
    points: [thisSnapPoint, otherSnapPoint],
    offset: offsetX,
});
minOffset[0] = Math.abs(offsetX);
```

すべてのスナップ点を計算したあと、この最小距離をスナップ距離として使えます。この段階では、図形がまだスナップ距離に従って移動していない点に注意が必要です。したがって、図形がすでに最終位置へ移動したと仮定して、もう一度計算する必要があります。

```ts
// 1st round
getPointSnaps();
const snapOffset: [number, number] = [
    nearestSnapsX[0]?.offset ?? 0,
    nearestSnapsY[0]?.offset ?? 0,
];

// Clear the min offset
minOffset[0] = 0;
minOffset[1] = 0;
nearestSnapsX.length = 0;
nearestSnapsY.length = 0;
const newDragOffset: [number, number] = [
    round(dragOffset[0] + snapOffset[0]),
    round(dragOffset[1] + snapOffset[1]),
];

// 2nd round, a new offset must be considered.
getPointSnaps(newDragOffset);

// Render snap lines
```

### ギャップスナップの取得 {#get-gap-snaps}

キャンバス上では、現在選択されている図形以外にも、他の図形が組になって、その間にギャップを作ることがあります。Excalidraw のコードにある図がこれをよく表しています。`horizontalGap` を例に取ります。

```ts
// https://github.com/excalidraw/excalidraw/blob/f55ecb96cc8db9a2417d48cd8077833c3822d64e/packages/excalidraw/snapping.ts#L65C1-L81C3
export type Gap = {
    //  start side ↓     length
    // ┌───────────┐◄───────────────►
    // │           │-----------------┌───────────┐
    // │  start    │       ↑         │           │
    // │  element  │    overlap      │  end      │
    // │           │       ↓         │  element  │
    // └───────────┘-----------------│           │
    //                               └───────────┘
    //                               ↑ end side
    startBounds: Bounds;
    endBounds: Bounds;
    startSide: [GlobalPoint, GlobalPoint];
    endSide: [GlobalPoint, GlobalPoint];
    overlap: InclusiveRange;
    length: number;
};
```

選択された図形のバウンディングボックスがギャップと重ならない場合は、検出をスキップします。

```ts
for (const gap of horizontalGaps) {
    if (!rangesOverlap([minY, maxY], gap.overlap)) {
        continue;
    }
}
```

中心点、右端、左端の順に検出します。

```ts
// center
if (gapIsLargerThanSelection && Math.abs(centerOffset) <= minOffset[0]) {
}
// side right
if (Math.abs(sideOffsetRight) <= minOffset[0]) {
}
// side left
if (Math.abs(sideOffsetLeft) <= minOffset[0]) {
}
```

条件を満たしたら記録します。その過程で、最小距離を継続して記録します。

```ts
const snap: GapSnap = {
    type: 'gap',
    direction: 'center_horizontal',
    gap,
    offset: centerOffset,
};
nearestSnapsX.push(snap);
```

### スナップ線の描画 {#render-snap-lines}

SVG コンテナにスナップ線を描画します。参照: [第 26 課 - なげなわ選択]。

スナップ点は通常「十字」で表し、これらの点をつなぐ線は `<line>` で描画できます。

```ts
renderSnapLines(
    api: API,
    snapLines: { type: string; points: [number, number][] }[],
) {
    const { svgSVGElement } = this.selections.get(api.getCamera().__id);
    this.clearSnapLines(api);

    snapLines.forEach(({ type, points }) => {
        if (type === 'points') {
            const pointsInViewport = points.map((p) =>
                api.canvas2Viewport({ x: p[0], y: p[1] }),
            );
            const line = createSVGElement('polyline') as SVGPolylineElement;
            svgSVGElement.appendChild(line);
        }
    });
}
```

ギャップのスナップ線の表示について、Excalidraw のドキュメントはとても分かりやすいです。これを土台に、補助線の下（水平方向）または右（垂直方向）へ、距離を示すテキストラベルを追加できます。Figma の扱い方に似ています。

```ts
// a horizontal gap snap line
// |–––––––||–––––––|
// ^    ^   ^       ^
// \    \   \       \
// (1)  (2) (3)     (4)
```

![ギャップのスナップ線と距離ラベルの表示](/snap-to-objects.gif)

下の中央の矩形を移動またはリサイズしてみてください。独立したコントロールで、オブジェクトスナップとピクセルグリッドのスナップを比較できます。

<SnapToObjects />

## さらに読む {#extended-reading}

-   [How to snap shapes positions on dragging with Konva?]
-   [Custom snapping in tldraw]

[第 5 課 - グリッドを描く]: /ja/guide/lesson-005
[How to snap shapes positions on dragging with Konva?]: https://konvajs.org/docs/sandbox/Objects_Snapping.html
[Snap to grid in Excalidraw]: https://github.com/excalidraw/excalidraw/issues/521
[Custom snapping in tldraw]: https://tldraw.dev/examples/bounds-snapping-shape
[isSnappingEnabled]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L162C14-L162C31
[getPointSnaps]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L636
[snapDraggedElements]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L692
[snapResizingElements]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L1108C14-L1108C34
[renderSnaps]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/renderer/renderSnaps.ts
[第 8 課 - 空間インデックスを使う]: /ja/guide/lesson-008#using-spatial-indexing
[第 26 課 - なげなわ選択]: /ja/guide/lesson-026#lasso-selection
