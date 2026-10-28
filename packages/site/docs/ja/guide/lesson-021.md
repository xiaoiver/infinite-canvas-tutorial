---
outline: deep
description: 'リサイズと回転ができる図形の Transformer を実装します。アンカー、座標系の変換、CSS カーソルのカスタマイズ、ヒット領域の拡大を通して、直感的な図形編集を学びます。'
head:
    - ['meta', { property: 'og:title', content: '第21課 - トランスフォーマー' }]
---

<script setup>
import TransformerRect from '../../components/TransformerRect.vue'
import TransformerRectRotated from '../../components/TransformerRectRotated.vue'
import TransformerLine from '../../components/TransformerLine.vue'
import TransformerPolyline from '../../components/TransformerPolyline.vue'
import TransformerPath from '../../components/TransformerPath.vue'
</script>

# 第 21 課 - トランスフォーマー {#lesson-21-transformer}

[Lesson 14] で、キャンバスモードの「選択モード」を簡単に紹介しました。このモードでは図形を選択したあと、図形の上に操作レイヤーを重ね、ドラッグで図形を移動できます。この課では、リサイズと回転を含む、より多くの図形編集機能を用意します。

Konva では、選択した図形の上の操作レイヤーを [Transformer] と呼び、次の例を提供しています。

-   [HTML5 Canvas Shape select, resize and rotate]
-   [Limit Dragging and Resizing]

私たちも Transformer という名前を使うことにしました。図形の AABB ととてもよく似て見えます。実際には OBB（oriented bounding box、方向を持つバウンディングボックス）と呼ばれ、ワールド座標において回転角を持つ矩形です。

<TransformerRect />

## 変換行列と寸法情報のシリアライズ {#serialize-transform-dimension}

Figma における図形のローカル変換行列と寸法情報は次のとおりです。2D 図形の mat3 変換行列は、移動、スケール、回転に分解できます。そのうち X/Y は移動に対応し、スケールは[反転](#flip)の節で扱います。[fig-file-parser]

![出典: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions](https://help.figma.com/hc/article_attachments/29799649003671)

そこで [SerializedNode] の構造を変更し、できるだけ多くの図形を記述できるようにしつつ、Circle の `cx/cy` のような一部の位置属性を取り除きました。`x/y` と `width/height` から `cx/cy` を計算できるからです。

```ts
export interface TransformAttributes {
    // Transform
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
    // Dimension
    width: number;
    height: number;
}
```

`<circle cx="100" cy="100" r="50" />` は次のようにシリアライズします。あとからより柔軟にリサイズできるよう、`ellipse` で表します。

```js eval code=false
call(() => {
    const { createSVGElement, svgElementsToSerializedNodes } = ECS;
    const $circle = createSVGElement('circle');
    $circle.setAttribute('cx', '100');
    $circle.setAttribute('cy', '100');
    $circle.setAttribute('r', '50');
    const nodes = svgElementsToSerializedNodes([$circle]);
    return nodes[0];
});
```

`point` と `d` 属性で定義されるポリラインやパスのような図形では、これらの属性を削除できません。代わりに AABB を計算し、これらの属性を再計算する必要があります。`<polyline points="50,50 100,100, 100,50" />` を例にすると、次のとおりです。

```js eval code=false
call(() => {
    const { createSVGElement, svgElementsToSerializedNodes } = ECS;
    const $polyline = createSVGElement('polyline');
    $polyline.setAttribute('points', '50,50 100,100, 100,50');
    const nodes = svgElementsToSerializedNodes([$polyline]);
    return nodes[0];
});
```

## アンカー {#anchors}

Transformer のアンカーは、リサイズ（Resize）と回転の二種類に分かれ、個数にはよく使われる組み合わせが二つあります。

一つは Excalidraw と Konva が採用する方式で、周囲の 8 個のアンカーでリサイズし、回転用のアンカーを別に持ちます。

![出典: https://csswolf.com/the-ultimate-excalidraw-tutorial-for-beginners/](https://sp-ao.shortpixel.ai/client/to_auto,q_lossy,ret_img,w_1148/https://csswolf.com/wp-content/uploads/2023/11/image-9.png)

もう一つは tldraw と Figma が採用する方式で、アンカーは 4 個です。この 4 個のアンカーに外側から近づくと回転になり、水平方向と垂直方向のリサイズは四辺をドラッグして行います。

![出典: https://wpdean.com/how-to-rotate-in-figma/](https://wpdean.com/wp-content/uploads/2024/12/how-to-rotate-in-figma.jpg)

私たちは、より簡潔に見えるこの方式を選びました。親ノードは `Rect` のマスクで、四つの子ノードは `Circle` のアンカーです。

```ts
const mask = this.commands.spawn(
    new UI(UIType.TRANSFORMER_MASK),
    new Transform(),
    new Renderable(),
    new Rect(), // Using Rect component
);
const tlAnchor = this.createAnchor(0, 0, AnchorName.TOP_LEFT); // Using Circle component
const trAnchor = this.createAnchor(width, 0, AnchorName.TOP_RIGHT);
const blAnchor = this.createAnchor(0, height, AnchorName.BOTTOM_LEFT);
const brAnchor = this.createAnchor(width, height, AnchorName.BOTTOM_RIGHT);

this.commands
    .entity(mask)
    .appendChild(this.commands.entity(tlAnchor))
    .appendChild(this.commands.entity(trAnchor))
    .appendChild(this.commands.entity(blAnchor))
    .appendChild(this.commands.entity(brAnchor));
```

### Transformer の座標系 {#transformer-coordinates}

[Lesson 6 - Coordinate System Conversion] で、Viewport、Canvas、Client 座標系の間の変換を実装しました。ここでは新しい座標系、つまりマスクのローカル座標系を導入する必要があります。たとえばマスクに回転のような変換があると、子ノードであるアンカーはワールド座標系での自分の位置を知る必要があります。この変換メソッドの一式を追加します。

```ts
transformer2Canvas(camera: Entity, point: IPointData) {
    const { mask } = camera.read(Transformable);
    const matrix = Mat3.toGLMat3(mask.read(GlobalTransform).matrix);
    const [x, y] = vec2.transformMat3(
      vec2.create(),
      [point.x, point.y],
      matrix,
    );
    return {
      x,
      y,
    };
}
canvas2Transformer(camera: Entity, point: IPointData) {}
```

### CSS カーソルの表示 {#display-css-cursor}

アンカーにホバーしたとき、マウスのスタイルは対応する機能を直感的に示す必要があります。Web 側で `<canvas>` のスタイルを変更して実装します。既定の [CSS cursor] がサポートするアイコンは限られています。たとえば回転を意味するアイコンはなく、Excalidraw と Konva では `grab` で代用するしかありません。また、リサイズ用のアイコンは確かに 8 個ありますが、図形は回転できます。回転角が 45 の整数倍でないとき、Konva のように計算して適切なアイコンを選んでも、正確には表せません。

```ts
function getCursor(anchorName: string, rad: number) {
    rad += DEG_TO_RAD * (ANGLES[anchorName] || 0);
    const angle = (((RAD_TO_DEG * rad) % 360) + 360) % 360;

    if (inRange(angle, 315 + 22.5, 360) || inRange(angle, 0, 22.5)) {
        return 'ns-resize';
    }
}
```

そのため、カスタムのマウススタイルが必要で、回転角に応じて動的に調整できる必要があります。[How can I rotate a css cursor] は SVG を使う方法を示し、tldraw はその上に角度を動的に計算するロジックを加えています。詳しくは [useCursor] を参照してください。右上のアンカーを例にすると、次のとおりです。

![回転アンカー](/transformer-anchor-rotate.png)

SVG アイコンに回転変換を適用すると、このときの Cursor の値が得られます。

```ts
// SVG angles are in degrees; both reflections are in the object's local axes.
const sx = scaleX < 0 ? -1 : 1;
const sy = scaleY < 0 ? -1 : 1;
const r = (rotation - cameraRotation) * RAD_TO_DEG;
const transform = `translate(16 16) rotate(${r}) scale(${sx} ${sy}) rotate(${tr}) translate(-16 -16)`;
```

各スケール軸の符号は保ちます。SVG は変換を右から左へ適用します。ハンドルに合わせてアイコンの向きを決め、図形のローカル軸で反転し、そのあとビューポートの向きへ回転します。行列式だけでは、水平反転、垂直反転、両軸反転を区別できません。回転のあとに反転すると、カーソルが誤った方向を指します。

そしてマウスがアンカーにさらに近づくと、回転からリサイズのインタラクションに変わります。

![リサイズアンカー](/transformer-anchor-resize.png)

遠くからアンカーに近づいた時点で、ピッキングをどのように起こすのでしょうか。

### ヒット領域を広げる {#hit-area}

まず考えたのは、図形がヒット領域を広げたり、独自に指定したりできるようにすることです。たとえば Pixi.js は [hitArea] を提供しています。Renderable コンポーネントにもこのフィールドを追加できます。

```ts
export class Renderable {
    @field({ type: Type.object, default: null }) declare hitArea: Circle | Rect;
}
```

ComputeBounds システムでバウンドを計算するときこのプロパティを考慮すれば、アンカーより大きい円形の判定領域を設定できます。

```ts
if (hitArea instanceof Circle) {
    renderBounds = Circle.getRenderBounds(hitArea);
}
```

ただし、この方法には明らかな問題があります。ヒット領域をアンカーの 5 倍にしても、カメラがズームすると、やはりアンカーの上にホバーしないとピッキングが起きません。そのため、Canvas のワールド座標系の外でピッキングを考える必要があります。

### ビューポート座標でのピッキング {#picking-in-viewport-coordinates}

Viewport 座標系でピッキング判定を行う必要があり、そうすればカメラのズームを無視できます。

まず、四つのアンカーの位置を Canvas のワールド座標系で計算する必要があります。アンカーの `cx/cy` をそのまま使うと、Transformer 自体に回転があるときにずれます（このあとすぐに見ます）。

```ts
hitTest(api: API, { x, y }: IPointData) {
    const { tlAnchor, trAnchor, blAnchor, brAnchor } = camera.read(Transformable);

    const { x: tlX, y: tlY } = api.canvas2Viewport(
        // Need to consider Transformer's own transformation, such as rotation
        api.transformer2Canvas(camera, {
            x: tlAnchor.read(Circle).cx,
            y: tlAnchor.read(Circle).cy,
        }),
    );
    // Omit calculation of other anchor positions

    const distanceToTL = distanceBetweenPoints(x, y, tlX, tlY);
}
```

次に、四つのアンカーまでの最小距離がリサイズのインタラクションの閾値を満たすかを先に判定します。満たす場合は、対応するマウススタイルのアイコン名を返し、回転角を加えて回転した SVG を得ます。

```ts
if (minDistanceToAnchors <= TRANSFORMER_ANCHOR_RESIZE_RADIUS) {
    if (minDistanceToAnchors === distanceToTL) {
        return {
            anchor: AnchorName.TOP_LEFT,
            cursor: 'nwse-resize',
        };
    }
}
```

次に、回転のインタラクション判定に入ります。このとき判定点は Transformer の内側にあってはなりません。[Check if Point Is Inside A Polygon] で紹介されている判定方法を使えます。

```ts
else if (
    !isInside &&
    minDistanceToAnchors <= TRANSFORMER_ANCHOR_ROTATE_RADIUS
) {
    if (minDistanceToAnchors === distanceToTL) {
        return {
            anchor: AnchorName.TOP_LEFT,
            cursor: 'nwse-rotate',
        };
    }
}
```

最後に、Transformer の四辺に対するリサイズ判定です。ここでは判定点から線分までの距離を計算する必要があります。[Gist - point to line 2d] を参照してください。

```ts
import distanceBetweenPointAndLineSegment from 'point-to-segment-2d';

const distanceToTopEdge = distanceBetweenPointAndLineSegment(
    point,
    [tlX, tlY],
    [trX, trY],
);
// Omit calculation of distance to other 3 edges

if (minDistanceToEdges <= TRANSFORMER_ANCHOR_RESIZE_RADIUS) {
    if (minDistanceToEdges === distanceToTopEdge) {
        return {
            anchor: AnchorName.TOP_CENTER,
            cursor: 'ns-resize',
        };
    }
}
```

## 単一図形のリサイズ {#resize-single-shape}

Figma / FigJam では、四隅のアンカーと四辺をドラッグしてサイズを自由に変えることに加え、次のこともできます。

-   <kbd>Option</kbd> または <kbd>Alt</kbd> を押しながらドラッグすると、幾何学的な中心からスケールします
-   <kbd>Shift</kbd> を押しながらドラッグすると、向かいの角や辺を固定し、水平方向と垂直方向に比例してスケールします
-   これらのキーを組み合わせます

効果は次のとおりで、出典は [Resize, rotate, and flip objects in FigJam] です。

![FigJam でのリサイズ](https://help.figma.com/hc/article_attachments/1500011223302)

まず、サイズを自由に変える実装を見ます。左上のアンカーを例にすると、ドラッグ中は右下のアンカーが固定されます。

```ts
private handleSelectedResizing(
    api: API,
    canvasX: number,
    canvasY: number,
    anchorName: AnchorName,
) {
    const { x, y } = api.canvas2Transformer({
      x: canvasX,
      y: canvasY,
    });
    if (anchorName === AnchorName.TOP_LEFT) {
        // Set top-left anchor point position
        Object.assign(tlAnchor.write(Circle), {
            cx: x,
            cy: y,
        });
    }
    // Omit other anchor point handling logic
    {
        const { cx: tlCx, cy: tlCy } = tlAnchor.read(Circle);
        const { cx: brCx, cy: brCy } = brAnchor.read(Circle);
        const width = brCx - tlCx;
        const height = brCy - tlCy;
        const { x, y } = api.transformer2Canvas({ x: tlCx, y: tlCy });
        // Recalculate selected shape position and size
        this.fitSelected(api, {
            x,
            y,
            width,
            height,
            rotation: this.#rotation,
        });
    }
}
```

最後に、左上と右下のアンカーに基づいて、選択した図形を変換します。

### 図形を変換する {#transform-shape}

リサイズの前後のプロパティ（変換と寸法の情報）が分かっているので、二つの状態の間の遷移行列は簡単に計算できます。

```plaintext
// @see https://github.com/konvajs/konva/blob/master/src/shapes/Transformer.ts#L1106

[delta transform] = [new transform] * [old transform inverted]
```

```ts
const baseSize = 10000000;
const oldTr = mat3.create();
mat3.translate(oldTr, oldTr, [oldAttrs.x, oldAttrs.y]);
mat3.rotate(oldTr, oldTr, oldAttrs.rotation);
mat3.scale(oldTr, oldTr, [
    oldAttrs.width / baseSize,
    oldAttrs.height / baseSize,
]);
const newTr = mat3.create();
mat3.translate(newTr, newTr, [newAttrs.x, newAttrs.y]);
mat3.rotate(newTr, newTr, newAttrs.rotation);
mat3.scale(newTr, newTr, [
    newAttrs.width / baseSize,
    newAttrs.height / baseSize,
]);

const delta = mat3.multiply(newTr, newTr, mat3.invert(mat3.create(), oldTr));
```

この行列を選択した図形に直接適用することはできません。シーングラフで親ノードがワールド座標系において持つ変換も考慮する必要があります。

```plaintext
[delta transform] * [parent transform] * [old local transform] = [parent transform] * [new local transform]
```

親のワールド変換の逆変換を左から掛けると、選択した図形のローカル座標系での新しい変換が得られます。

```plaintext
[new local] = [parent inverted] * [delta] * [parent] * [old local]
```

最後に、ローカル座標系の新しい行列を選択した図形に適用します。

### アスペクト比を固定する {#lock-aspect-ratio}

やはり左上のアンカーを例にすると、アスペクト比をロックするときはその位置を直接設定できません。右下のアンカーの位置は変えず、ドラッグ開始時の図形のアスペクト比に基づいて、左上のアンカーの位置を再計算する必要があります。

まず、アンカーのドラッグを開始するとき、選択した図形の OBB とアスペクト比を記録します。これは対角線の傾きに相当します。

```ts
if (input.pointerDownTrigger) {
    if (type === UIType.TRANSFORMER_ANCHOR) {
        this.#obb = this.getSelectedOBB();
        const { width, height } = this.#obb;
        const hypotenuse = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2));
        this.#sin = Math.abs(height / hypotenuse);
        this.#cos = Math.abs(width / hypotenuse);
    }
}
```

ドラッグ中は次のとおりです。

1. 右下のアンカーの位置は変えません
2. このときの左上から右下までの対角線の距離を計算します
3. 以前保存したアスペクト比に基づいて、左上のアンカーの位置を再計算します

```ts
if (lockAspectRatio) {
    // 1.
    const comparePoint = {
        x: brAnchor.read(Circle).cx,
        y: brAnchor.read(Circle).cy,
    };
    // 2.
    newHypotenuse = Math.sqrt(
        Math.pow(comparePoint.x - x, 2) + Math.pow(comparePoint.y - y, 2),
    );
    const { cx, cy } = tlAnchor.read(Circle);
    const reverseX = cx > comparePoint.x ? -1 : 1;
    const reverseY = cy > comparePoint.y ? -1 : 1;
    // 3.
    Object.assign(tlAnchor.write(Circle), {
        cx: comparePoint.x - newHypotenuse * this.#cos * reverseX,
        cy: comparePoint.y - newHypotenuse * this.#sin * reverseY,
    });
}
```

Konva.js は、アスペクト比を保ったまま四辺すべてをドラッグすることをサポートしていません。その場合は、この四つのアンカーを無効にする必要があります。詳しくは [Is there a way to keep the image aspect ratio on transform?] を参照してください。

私たちはこれを簡単に実現できます。右辺のアンカーをドラッグする場合を例にすると、次のとおりです。

1. まず、右下のアンカーの X 座標を設定します
2. 左上のアンカーの X 座標は変わらないので、変換後の幅を計算できます
3. アスペクト比がロックされているので変換後の高さも決まり、その高さを計算できます
4. 変換前後の高さの差に基づいて、左上と右下のアンカーの Y 座標を設定します

```ts
if (anchorName === AnchorName.MIDDLE_RIGHT) {
    // 1.
    brAnchor.write(Circle).cx = x;

    if (lockAspectRatio) {
        // 2.
        const newWidth = brAnchor.read(Circle).cx - tlAnchor.read(Circle).cx;
        const tan = sin / cos;
        const newHeight = newWidth * tan; // 3.
        const deltaY = newHeight - (prevBrAnchorY - prevTlAnchorY);
        // 4.
        brAnchor.write(Circle).cy = brAnchor.read(Circle).cy + deltaY / 2;
        tlAnchor.write(Circle).cy = tlAnchor.read(Circle).cy - deltaY / 2;
    }
}
```

ドラッグ中は対角線をリアルタイムに表示し、ユーザーにはっきりしたヒントを出せます（通常は破線）。

### 中心を基準にした拡大縮小 {#centered-scaling}

やはり左上のアンカーを例にすると、このとき固定する基準点は右下のアンカーから幾何学的な中心点に変わり、これもドラッグ開始時に記録します。

```ts
const comparePoint = centeredScaling
    ? {
          x: this.#obb.width / 2, // [!code ++]
          y: this.#obb.height / 2, // [!code ++]
      }
    : {
          x: brAnchor.read(Circle).cx,
          y: brAnchor.read(Circle).cy,
      };
```

それから右下のアンカーの位置を再計算します。中心点について、左上のアンカーと対称です。

```ts
if (centeredScaling) {
    const tlOffsetX = tlAnchor.read(Circle).cx - prevTlAnchorX;
    const tlOffsetY = tlAnchor.read(Circle).cy - prevTlAnchorY;
    Object.assign(brAnchor.write(Circle), {
        cx: brAnchor.read(Circle).cx - tlOffsetX,
        cy: brAnchor.read(Circle).cy - tlOffsetY,
    });
}
```

### 反転 {#flip}

アンカーや辺を反対方向へドラッグすると、反転が起きます。次は Figma での効果です。Rotation の変化に注目してください。

![反転すると 180 度回転する](/resize-flip.gif)

グラデーションの背景を使い、この反転効果をよりはっきり示します。

![グラデーション塗りのある矩形の反転](/rotate-when-flipped.png)

辺を越える反転は、既定では無効です。このページ先頭のインタラクティブな例ではこれを有効にし、オレンジから青へのグラデーションでミラーリングが見えるようにしています。

```ts
api.setAppState({ flipEnabled: true });
```

ジェスチャの間は、ポインタを押した時点の選択フレーム、ノードの変換、ハンドルの同一性を固定したままにします。ポインタをその元のフレームへ変換し、向かいの角または辺（Alt / Option を押しているときは中心）を基準に、符号付きの寸法を計算します。負の寸法は反転を意味します。ハンドルを入れ替えてから寸法の絶対値を早すぎる時点で取ると、その反転が失われるか、次のフレームで固定した辺が動きます。サイズがちょうど 0 のときは、0 でない小さな寸法を使い、その後のサンプルは元のフレームから計算し続けます。

変換を適用したあと、ノードの `width` / `height` は正のままにし、`rotation` と `scaleX` / `scaleY` は同じ行列分解から得ます。分解した回転と、以前のスケールの符号を組み合わせるのは正しくありません。パス、ポリライン、VectorNetwork のジオメトリをベイクするときは、Transform にすでに残している回転と反転を取り除き、ジオメトリが二度ミラーリングされないようにします。

反転した行列には、同等な回転とスケールの分解が複数あり得ます。Rotation が 180° 変化したことだけを要求せず、ミラーリングされた図形とグラデーション、固定した辺、ハンドルの位置を確認します。Shift はアスペクト比を保ち、Alt / Option は中心を保ちます。離したあとのフレーム、次のジェスチャ、元に戻す/やり直すも一貫している必要があります。

## 回転 {#rotation}

Figma での回転は次のとおりです。

> レイヤーの境界のすぐ外側にホバーすると、アイコンが表示されます。
> クリックしてドラッグし、選択範囲を回転します。
> 時計回りにドラッグすると負の角度（-180° 方向）になります。
> 反時計回りにドラッグすると正の角度（180° 方向）になります。
> Shift を押したままにすると、回転値が 15° 刻みにスナップします。

1. ポインタを押したとき、OBB とローカルのピボット、ワールドのピボットを保存します。カスタムのピボットがなければ幾何学的な中心を使います。
2. キャンバス座標で、直前のポインタ角度を追跡します。隣接する `atan2` の差分を累積し、`atan2(sin, cos)` で正規化して、±π をまたいでも連続するようにします。
3. その固定したピボットと初期 OBB から新しい原点と回転を解き、`Select.fitSelected` でノードを更新します。複数選択の回転中は、同じように回転した初期フレームを表示し、離したときにワールド軸へ揃えた和集合へ戻します。

ECS モジュール `systems/select/rotate-gesture.ts` が、ジェスチャの開始、サンプリング、完了、後始末を担当します。`Select` は入力の振り分け、ノードの更新、履歴を保持します。`resize-gesture.ts` は、リサイズの制約、スナップ、端点のドラッグ、タッチのオフセットを担当します。

```ts
// Pointer down, after converting to canvas coordinates and pixel snapping:
beginRotateGesture(api, selection, { x: canvasX, y: canvasY });

// Pointer move:
updateRotateGesture(api, selection, { x: canvasX, y: canvasY }, (obb) => {
    this.fitSelected(api, obb, selection);
});

// Pointer up; Select records the resulting document once afterwards:
finishRotateGesture(api, selection);
```

<TransformerRectRotated />

### 回転原点を変更する {#change-the-rotation-origin}

次は Figma の [Change the rotation origin] の効果です。

![回転原点の変更](https://help.figma.com/hc/article_attachments/31937330391447)

実装上のメモは次のとおりです。

1. Transformer のマスクに中心アンカー（`AnchorName.CENTER`）を追加します。このアンカーはドラッグできます。
2. カスタムの回転原点を Transformer のローカル座標（`rotatePivotX/Y`）に保存し、ユーザーが固定したかどうか（`rotatePivotPinned`）を記録します。
3. 中心アンカーをドラッグしている間にポインタが動いたら、キャンバス座標を Transformer のローカル座標へ変換します。

```ts
const { x, y } = api.canvas2Transformer({ x: canvasX, y: canvasY }, mask);
tf.rotatePivotX = x;
tf.rotatePivotY = y;
tf.rotatePivotPinned = true;
```

4. 回転中はこのピボットを使い（未設定なら幾何学的な中心に戻します）、新しい OBB の原点を解く間、ピボットのワールド位置は固定したままにします。

```ts
const {
    obb,
    pivotWorld: [px, py],
    pivotLocal: [lx, ly],
} = gesture;
const rotation = obb.rotation + gesture.accumulated;
const c = Math.cos(rotation);
const s = Math.sin(rotation);
const newAttrs = {
    ...obb,
    x: px - lx * obb.scaleX * c + ly * obb.scaleY * s,
    y: py - lx * obb.scaleX * s - ly * obb.scaleY * c,
    rotation,
};
```

5. 選択されたノードの集合が変わったら、ピボットを中心へ戻します。

## 矢印キーで図形を移動する {#nudge-the-position}

Figma は [Nudge layers] 機能を提供し、上下左右の矢印キーで図形を移動でき、<kbd>Shift</kbd> でより大きな距離も移動できます。私たちの実装では、固定の距離を使います。

```ts
if (e.key === 'ArrowUp') {
    e.preventDefault();
    this.api.updateNodeOBB(selected, { y: selected.y - 10 });
    this.api.record();
}
```

## 選択の整列と分布 {#align-distribute}

ECS API は、`left`、`right`、`top`、`bottom`、`centerH`、`centerV` の六つの整列モードを提供します。ストロークの太さを除いた、ワールド空間のジオメトリバウンドを使います。変わるのは位置だけです。回転、反転、寸法、パスデータ、テキストメトリクス、Flex のサイズ設定は保たれ、親が回転またはスケールしていても同じです。

```ts
const ids = [...api.getAppState().layersSelected];
await api.edit((editor) => {
    editor.alignSelectedNodes('left', ids);
});
// Run a separate edit so derived geometry is refreshed between operations.
await api.edit((editor) => {
    editor.distributeSelectedNodesSpacing('horizontal', ids);
});
```

間隔の分布は `horizontal` または `vertical` を受け取ります。そのワールド軸に沿ってノードをソートし、選択範囲の広がりから、端と端の間隔が等しくなるように計算します。図形が重なるときは、間隔が負になることがあります。重複した ID、削除済み、存在しない、ロックされたノード、そして逆変換できない親の変換はスキップします。選択された子孫は、選択された祖先と一緒に移動し、二度は移動しません。条件を満たす最上位ノードが少なくとも二つ必要です。これらのメソッドはノードが移動したかどうかを返し、レイアウトが変わっていなければメソッド自身は記録しません。

プロパティパネルは、これらの操作を `api.edit()` で送信します。クリックが受け入れたキャンバスと ID を保持し、書き込み段階で現在のノードを解決してから、元に戻す一歩としてコミットします。削除やロックによって変化がなくなると、キューに入った操作は、関係のない未反映の編集を取り込まずにキャンセルされます。API の呼び出し側も、`edit()` に `AbortSignal` を渡し、変更の前にキャンセルできます。

## 他の図形の Transformer {#transformer-for-other-shapes}

ここまで実装した Transformer は、円、楕円、矩形のような図形には向いていますが、直線、ポリラインの区間、区分的な曲線には向いていません。後者には、より多くの制御点が必要です。

### 直線の Transformer {#transformer-for-line}

直線にはアンカーが二つだけ必要なので、以前紹介したバウンディング矩形に基づく一連の処理を大幅に簡略化できます。

```ts
export class Transformable {
    @field.ref declare lineMask: Entity;
    @field.ref declare x1y1Anchor: Entity;
    @field.ref declare x2y2Anchor: Entity;
}
```

![直線の Transformer](/line-transformer.gif)

<TransformerLine />

### ポリラインの Transformer {#transformer-for-polyline}

ポリラインでは、各接続点に対応する制御点があり、隣り合う制御点の組ごとにその間へ点を一つ追加して、新しい線分を作ります。

```ts
export class Transformable {
    @field.ref declare polylineMask: Entity;
    @field.object declare controlPoints: Entity[];
    @field.object declare segmentMidpoints: Entity[];
}
```

対応するインタラクションは、制御点にホバーして <kbd>Delete</kbd> キーを押すとその点を削除できる、というものです。矩形の Transformer によるリサイズと回転、そして頂点編集の両方に対応するため、ダブルクリックで制御点の編集モードに入ることもサポートします。

<TransformerPolyline />

### パス {#transformer-for-path}

tldraw は [cubic-bezier-shape] という例を提供しています。インタラクティブな編集では、二つの問題を解く必要があります。

1. **安定して編集できる点**: すべてのアンカーとすべてのベジェ制御点を選択してドラッグでき、変更は `d` に書き戻します。
2. **意味を失わないラウンドトリップ**: 可能な限り小さく予測できるコマンド型の集合を使い、エディタの中で完全なパスパーサを一から作りません。

そこで `d` を少数のコマンド語彙へ正規化し（たとえば相対コマンドを絶対コマンドへ変換し）、**コマンドインデックス + 配列内の座標オフセット**を各ハンドルの同一性として使います。ドラッグ中に変わるのは数値の座標だけで、最後に `path2String` が文字列へシリアライズし直します。

| コマンド | 作られるハンドル | `meta` の意味                                                                    |
| -------- | ---------------- | -------------------------------------------------------------------------------- |
| M / L    | 頂点が一つ       | `coordOffset: 1` → その点 `(x, y)`                                               |
| Q        | 制御点 + 終点    | オフセット `1` と `3`                                                            |
| C        | cp1、cp2、終点   | オフセット `1`、`3`、`5`                                                         |
| A        | 終点のみ         | オフセット `6`（このエディタでは弧にベジェハンドルはなく、終点だけを公開します） |

```ts
interface PathControlHandleMeta {
    commandIndex: number; // Index in the normalized command array.
    coordOffset: number; // Start index of this handle’s coordinates (1-based, since `command[0]` is the command letter).
}

type HandlePoint = {
    x: number;
    y: number;
    meta: PathControlHandleMeta;
};
```

同様に、ダブルクリックで制御点の編集モードに入ります。

<TransformerPath />

## さらに読む {#extended-reading}

-   [Graphics Editor Development: Custom Cursor]

[Lesson 14]: /ja/guide/lesson-014
[Limit Dragging and Resizing]: https://konvajs.org/docs/sandbox/Limited_Drag_And_Resize.html
[HTML5 Canvas Shape select, resize and rotate]: https://konvajs.org/docs/select_and_transform/Basic_demo.html
[Transformer]: https://konvajs.org/api/Konva.Transformer.html
[Change the rotation origin]: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions#h_01JTK11ERHCSVFRSE9F4125HAZ
[Resize, rotate, and flip objects in FigJam]: https://help.figma.com/hc/en-us/articles/1500006206242-Resize-rotate-and-flip-objects-in-FigJam
[Nudge layers]: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions#h_01HNBH5565CW1S5FTNP6RZF00C
[How can I rotate a css cursor]: https://stackoverflow.com/questions/44817022/how-can-i-rotate-a-css-cursor
[Graphics Editor Development: Custom Cursor]: https://zhuanlan.zhihu.com/p/667709457
[useCursor]: https://github.com/tldraw/tldraw/blob/324a049abe8f414f96fdcbca68bb95396b6c1a46/packages/editor/src/lib/hooks/useCursor.ts#L12
[CSS cursor]: https://developer.mozilla.org/en-US/docs/Web/CSS/cursor
[hitArea]: https://pixijs.com/8.x/examples/events/custom-hitarea
[Check if Point Is Inside A Polygon]: https://stackoverflow.com/questions/22521982/check-if-point-is-inside-a-polygon
[Gist - point to line 2d]: https://gist.github.com/mattdesl/47412d930dcd8cd765c871a65532ffac
[Lesson 6 - Coordinate System Conversion]: /ja/guide/lesson-006#coordinates
[SerializedNode]: /ja/guide/lesson-010#shape-to-serialized-node
[fig-file-parser]: https://madebyevan.com/figma/fig-file-parser
[Is there a way to keep the image aspect ratio on transform?]: https://github.com/konvajs/react-konva/issues/407
[cubic-bezier-shape]: https://examples.tldraw.com/cubic-bezier-shape
