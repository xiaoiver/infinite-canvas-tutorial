---
outline: deep
description: 'SVG パスの高度な代替として VectorNetwork を扱います。トポロジー定義、共有する頂点と辺、塗りアルゴリズム、複雑なベクターグラフィックス編集のためのトポロジー演算子を学びます。'
head:
    - ['meta', { property: 'og:title', content: '第22課 - VectorNetwork' }]
---

<script setup>
import VectorNetwork from '../../components/VectorNetwork.vue';
import VectorNetworkCube from '../../components/VectorNetworkCube.vue';
import VectorNetworkFaceCut from '../../components/VectorNetworkFaceCut.vue';
</script>

# 第 22 課 - VectorNetwork {#lesson-22-vectornetwork}

この課では、次の内容を学びます。

-   SVG Path の限界
-   VectorNetwork とは何か
-   ペンツールで Path を変更する
-   ダブルクリックでベクター編集モードに入り、Move / Bend / Cut / Fill ツールを使う
-   トポロジー演算子: セグメントの分割、頂点の削除、Cut で閉じたループを開く

## SVG Path の限界 {#limitations-of-svg-path}

[Lesson 13 - Drawing path and sketchy style] でパスの描き方を学びました。Figma も [VectorPath API] を提供しており、SVG Path コマンドのサブセット（参照: [VectorPath-data]）と [fillRule]（Figma では windingRule）をサポートします。

```ts
node.vectorPaths = [
    {
        windingRule: 'EVENODD',
        data: 'M 0 100 L 100 100 L 50 0 Z',
    },
];
```

では、なぜ [VectorNetwork API] を導入するのでしょうか。SVG Path にはいくつか本質的な限界があるからです。[The Engineering behind Figma's Vector Networks] の記事が、これを具体的に示しています。次の図形は Path 一つだけでは表現できません。

![有効でないパス](https://alexharri.com/images/posts/vector-networks/3.svg)

複数の Path に分けて初めて表現できます。可能ではありますが、編集の場面では直感的な操作の一部ができません。たとえば左下の中心頂点をドラッグすると、独立した二つの Path でできているため、頂点が一つしか追従しません。

![より複雑な図形を作るために複数のパスを使います](https://alexharri.com/images/posts/vector-networks/4.svg)

頂点が辺を 2 本より多く持てないことに加え、辺も共有できません。[Vector Graphics Complexes] の原論文と PPT は SVG と Planar map を比較しており、どちらも重なり、共有頂点、共有辺をサポートできません。そこから新しい幾何表現（以下 VGC）が生まれました。

![SVG と Planar map の比較](/svg-path-vector-network-comparison.jpeg)

[vpaint] は VGC に基づいて実装されています。点と辺を結合したあと、編集中の相互作用がどれほど自然か分かります。

![vpaint](https://camo.githubusercontent.com/42f888c041ecc6799e9fe2bd3c895fcd8037417188a0d1db840e0ce0701a5201/68747470733a2f2f7777772e7667632e696f2f696d616765732f676c75652d30312d332d32346670732e676966)

あるいは [The Engineering behind Figma's Vector Networks] にある、立方体の辺をドラッグする例です。

![立方体の辺をドラッグ](https://alexharri.com/images/posts/vector-networks/31.svg)

ダブルクリックして編集モードに入り、立方体の任意の辺をドラッグします。

<VectorNetworkCube />

[Discussion in HN] では、VGC と Figma の VectorNetwork が驚くほど似ていると指摘されています。両者がほぼ同じ時期に探求を始め、異なる道筋で似た解にたどり着いたため、以降は VectorNetwork という用語を使います。

> CEO of Figma here. Most of the original insights around vector networks were in 2013, though we continued to polish the implementation over time. We didn't exit stealth and ship the closed beta of Figma until December 2015 which is why there isn't blog content before then.
> At first glance, this thesis looks super neat! I'm excited to check it out! I don't believe I've seen it before which is surprising given the overlap.

VectorNetwork がどのように定義されるかを見ていきます。

## VectorNetwork のトポロジー定義 {#topology-of-vector-network}

VectorNetwork / VGC の定義は Path よりはるかに複雑です。データ構造は頂点、辺、面（塗られた領域）からなるグラフです。次の図は [Vector Graphics Complexes] の原論文からのものです。

![VGC のトポロジー](/vgc-topology.png)

ここではトポロジー定義だけを扱います。その他の描画属性は Path と揃えることができます。

> On top of this core structure, more drawing attributes can be added for fine control on rendering. For instance, we added vertex radius, variable edge width, cell color (possibly transparent), and edge junctions style (mitre join or bevel join).

頂点は理解しやすいものです。VGC の辺は `start` と `end` の頂点インデックスの組からなり、両者が一致すると自己ループになります。

![VGC のノードと辺](/vgc-node-edge.png)

塗られた領域は頂点の閉じたループで定義されます。VGC ではハーフエッジの集合で定義します。

![VGC の面](/vgc-face.png)

次の三角形の例は [VectorNetwork API] からのものです。塗られた領域が頂点インデックスと fillRule で定義される点を除けば、VGC と基本的に一致します。`strokeCap` のような非幾何属性は Path と同じです。

```ts
node.vectorNetwork = {
    // The vertices of the triangle
    vertices: [
        { x: 0, y: 100 },
        { x: 100, y: 100 },
        { x: 50, y: 0 },
    ],

    // The edges of the triangle. 'start' and 'end' refer to indices in the vertices array.
    segments: [
        {
            start: 0,
            tangentStart: { x: 0, y: 0 }, // optional
            end: 1,
            tangentEnd: { x: 0, y: 0 }, // optional
        },
        {
            start: 1,
            end: 2,
        },
        {
            start: 2,
            end: 0,
        },
    ],

    // The loop that forms the triangle. Each loop is a
    // sequence of indices into the segments array.
    regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }],
};
```

Figma の 3 次曲線の規約に従います。*P*₀ は始点アンカー、*P*₃ は終点アンカーで、*P*₁ = *P*₀ + `tangentStart`、*P*₂ = *P*₃ + `tangentEnd` です。両方のハンドルがアンカーと重なるとき（直線）は 2 点を使い、それ以外は `CubicBezierCurve.getPoints` でサンプリングします。セグメント数は弦長と制御多角形から選びます（おおよそ 8–64）。

編集の場面では、頂点と辺はユーザーが定義し、塗られた領域はシステムが自動で計算する必要があります。では、これらの塗られた領域はどう見つけるのでしょうか。

### 塗り {#filling}

`click to fill` のような操作では、頂点が作る最小ループを見つける必要があります。

![出典: https://www.figma.com/blog/introducing-vector-networks/](https://alexharri.com/images/posts/vector-networks/40.gif)

VectorNetwork を平面グラフとみなし、各セグメントを向きのあるハーフエッジ 2 本に分けます。各頂点で出る辺を偏角順に並べ、「次のハーフエッジ」（入ってくる逆向きの辺から見て最も時計回りの出る辺）をたどると、すべての最小面を列挙できます。クリック位置を囲む面のうち最も小さいものが対象領域で、その順序付きセグメントインデックスのループを `VectorRegion.loops` に書けば、上の塗りテッセレーションを再利用できます。

```ts
export function findRegionLoopAtPoint(
    vertices: VectorVertexLike[],
    segments: VectorSegmentLike[],
    point: [number, number],
): number[] | null;
```

> 数値的な安定性: 同一直線上の辺、重なる頂点、自己ループには、いずれも EPS の許容誤差と退化ケースの処理が必要です。この走査では、有界でない外側の面の符号付き面積が正になるため、スキップしなければなりません。

### VectorNetwork への変換 {#convert-to-vector-network}

[figma-fill-rule-editor] に従い、次の型定義を使います。

```ts
export class VectorNetwork {
    @field.object declare vertices: VectorVertex[];
    @field.object declare segments: VectorSegment[];
    @field.object declare regions?: VectorRegion[];
}

interface VectorVertex {
    x: number;
    y: number;
    strokeLinecap?: Stroke['linecap'];
    strokeLinejoin?: Stroke['linejoin'];
    cornerRadius?: number;
    handleMirroring?: HandleMirroring;
}

interface VectorSegment {
    start: number;
    end: number;
    tangentStart?: VectorVertex;
    tangentEnd?: VectorVertex;
}

interface VectorRegion {
    fillRule: CanvasFillRule;
    loops: ReadonlyArray<ReadonlyArray<number>>;
}
```

[Polyline] は VectorNetwork へ変換するのが最も簡単な図形です。

```ts
class VectorNetwork {
    static fromEntity(entity: Entity): VectorNetwork {
        if (entity.has(Polyline)) {
            const { points } = entity.read(Polyline);
            const vertices: VectorVertex[] = points.map(([x, y]) => ({ x, y }));
            const segments: VectorSegment[] = points.slice(1).map((_, i) => ({
                start: i,
                end: i + 1,
            }));

            return { vertices, segments };
        }
    }
}
```

[Path] の変換は手順が増えます。SVG パスコマンドを正規化したあと（`path2Absolute`）、各コマンドを順に解釈します。`M/L/H/V` は直線セグメントを作り、`C/S/Q/T` は 3 次曲線を作ります（`Q/T` は先に 3 次へ次数を上げます）。絶対制御点は Figma 形式の相対接線 `tangentStart = P1 - P0`、`tangentEnd = P2 - P3` に変換します。`S/T` は反射のため、直前の制御点を追跡します。`Z` では、最後の点が始点と重なる場合、重複を避けるために始点頂点を再利用し、閉じたサブパスは領域ループを作ります。この処理は純粋関数 `pathToVectorNetwork(d, fillRule)` にあり、`fromEntity` が `entity.has(Path)` のときに呼び出します。

## テッセレーション {#tessellatation}

### ストローク {#stroke}

グラフをポリラインに変換し、[Lesson 12 - Draw polyline] の方法で描画します。

-   頂点ごとに隣接関係を保持します。
-   未使用の辺をたどります。開始辺から前後に伸ばし、現在の頂点に未使用の辺がちょうど 1 本残っているときだけ続けるため、次数 2 の接合は 1 本のポリラインになります（キャップではなくジョイン）。
-   分岐（次数 ≥ 3）で止まり、サブパスの間は `NaN` で区切ります。

たどった各辺について:

-   Figma の 3 次曲線を使います。*P*₀ と *P*₃ はアンカーで、*P*₁ = *P*₀ + `tangentStart`、*P*₂ = *P*₃ + `tangentEnd` です。
-   直線の辺（ハンドルがアンカー上にあるもの）は 2 点を使います。
-   それ以外は、弦長と制御多角形から求めたセグメント数で `CubicBezierCurve.getPoints` を使います。

```ts
function tessellateVectorSegment(
    vertices: VectorVertexLike[],
    seg: VectorSegmentLike,
): number[] {
    const a = vertices[seg.start];
    const b = vertices[seg.end];
    const p0 = vec2.fromValues(a.x, a.y);
    const p3 = vec2.fromValues(b.x, b.y);

    const ts = seg.tangentStart;
    const te = seg.tangentEnd;
    const p1 = vec2.create();
    const p2 = vec2.create();
    vec2.add(p1, p0, vec2.fromValues(ts?.x ?? 0, ts?.y ?? 0));
    vec2.add(p2, p3, vec2.fromValues(te?.x ?? 0, te?.y ?? 0));
}
```

<VectorNetwork />

### 塗り {#fill}

Figma の `loops` の各項目（順序付きセグメントインデックス）をたどり、3 次曲線を含むすべての辺を同じ `tessellateVectorSegment` でテッセレーションします。走査順につなぎ、重複点を除いて輪を閉じます。

-   各領域の各ループについて、閉じた輪郭を 1 本作ます。
-   **nonzero**（または Figma の `windingRule: 'NONZERO'`）: すべての輪郭に nonzero ワインディングを適用した `triangulate`（libtess）を使います。輪郭の順序に関係なく、つながっていない島と入れ子の穴をサポートします。
-   **evenodd**（または `EVENODD`）: `triangulate`（libtess）。
-   複数の領域は順に三角形分割し、頂点とインデックスは進行中の頂点オフセットとともに 1 つのメッシュへ連結します。

### クリックして領域を塗る {#click-to-fill}

VectorNetwork をダブルクリックして **Fill** を選びます。ホバーすると最も小さい囲まれた面をプレビューし、クリックで塗り、もう一度クリックで消します。クリック 1 回が元に戻す 1 ステップです。ドラッグ、キャンセルされたポインタ、マルチタッチのズームは塗りをコミットしません。ツールの切り替え、Esc、図形の外の空キャンバスのクリック、キャンバスの破棄はプレビューを消します。

下の立方体は **Fill** モードで始まります。正面、上面、右面にホバーしてプレビューし、クリックして塗ります。隣り合う 2 面を塗ったあと、どちらかをもう一度クリックすると、その面だけが消えます。キャンバスの **Undo / Redo** ボタンで変更を 1 ステップずつ確認してください。

<VectorNetworkCube fill />

**Fill** モードでは、ツールボタンの横の色見本をクリックするとカラーピッカーが開きます。面をクリックする前に色を選ぶか、色の値を入力します。色を変えると、このネットワークで既に塗られた面もすべて更新されます。色の変更は元に戻せます。現在、面は塗りスタイルを 1 つ共有します。

`findVectorNetworkFaces` は向きのあるハーフエッジをたどり、内側に含まれる非連結成分の外側境界を穴として付けます。プレビューと新しく作った領域は `evenodd` を使うため、穴は辺の格納方向に依存しません。既存の `nonzero` / `evenodd` の塗りは、覆っている範囲に応じて最小面へ分解され、1 面を消しても隣の面の塗りは残ります。

面はノードの `fills` を共有します。ストロークだけのネットワークへの最初の塗りは、ペンに設定された可視の塗りを使い、なければ青にフォールバックします。プレビューは一時的な SVG オーバーレイにだけあり、ドキュメント、書き出し、履歴には入りません。ピッキングはローカル座標を使い、回転、反転、スケールに対応します。

Fill は面を探す前に、一時的な幾何の上で交差を共有頂点へ分割します。ホバーはドキュメントを変えません。最初の塗りクリックがトポロジーとペイントをまとめてコミットし、元に戻す 1 回で両方を復元します。面ごとの独立したペイントは、別の拡張として残っています。

## ペンで描く {#drawing-with-pen}

**Vector Network** ペンを選びます。クリックでコーナーアンカーを置き、ドラッグでスムーズアンカーを置きます。最初のアンカーは最初の辺がコミットされるまで一時的なプレビューのままなので、点を 1 つ置いただけでやめれば、空のドキュメントノードは作られません。

ドラッグは新しいアンカーの出るハンドルを決めます。入るハンドルは逆向きのベクトルで、出るベクトルは次の辺の `tangentStart` になります。ラバーバンドのプレビューとコミットされた幾何は同じ 3 次の制御を使い、最初のアンカーをドラッグする場合も含みます。プレビューにはハンドル線も表示されます。

ビューポートの 10 ピクセル以内にある既存アンカーをクリックすると、ネットワークを閉じて Select に戻ります。スナップは押した位置を使うため、閉じるハンドルを遠くへドラッグしても頂点は増えません。閉じた面は自動で検出され、ペンに設定された塗りで描画されます。既定のストロークだけのスタイルは、**Fill** を使うまで塗られません。アクティブなアンカーをクリックするか、**Enter / Esc** を押すと、開いたパスを終えます。終わっていないドラッグは破棄されます。

コミットされた辺 1 本が、元に戻す 1 ステップです。ポインタのキャンセル、キャンバスから離れること、ツールの切り替えは、保留中のジェスチャを破棄し、コミット済みの辺は残します。元に戻す操作や外部の幾何編集は継続点を消すため、次のストロークが古くなった頂点にくっつきません。プレビューはそのキャンバスの SVG オーバーレイに属し、保存されるノード、履歴、書き出しからは除外されます。キャンバスを破棄するとプレビューも消えます。

### 既存のネットワークを続ける {#resume-with-pen}

VectorNetwork を選択してペンに切り替えます。既存の頂点の近くにホバーするとスナップ表示が出ます。その頂点をクリックして始め、次のアンカーをクリックまたはドラッグすると、同じネットワークに辺が追加されます。端点を延長し、共有頂点で分岐を作ります。最初のアンカーを選ぶだけではドキュメントは変わらず、コミットされた辺 1 本が元に戻す 1 ステップです。頂点から離れた場所で始めると、別のネットワークが作られます。

継続は回転、非一様スケール、反転に対応し、プレビューとコミットに同じ 3 次の制御を使います。既存の辺のハンドル、塗り、穴は保持されます。新しく囲まれた面は Fill で塗ります。既存の頂点へ接続するとストロークが終わり、同一の辺をなぞり直しても重複は作られません。ロックされたノード、非表示のノード、逆変換できないノードは継続できません。描画中のキャンセル、ツールの切り替え、元に戻す操作は、保留中の辺を破棄し、完了した編集は残します。

## ベンド {#bending}

**Bend** では、辺の上の内部の点を直接ドラッグします。アンカーは固定され、つかんだ曲線上の点がポインタに追従します。直線の辺は 3 次ベジェになります。更新は毎回、ポインタを押した時点のスナップショットから始まるため、制御点の変位は蓄積しません。ピッキングは画面座標を使い、回転、反転、非一様スケールを含みます。

パラメータ `t` における 2 つの制御重みは `a = 3(1-t)²t` と `b = 3(1-t)t²` です。ポインタ変位 `Δ` に対し、制御点は `aΔ/(a²+b²)` と `bΔ/(a²+b²)` だけ動きます。つかんだ点をポインタの下に保ちながら、制御点変位の二乗を最小化します。辺を直接曲げると、その端点のハンドル結合が外れ、他の辺の制御は維持されます。端点の近くでは、アンカーとハンドルの操作が優先されます。

ベクターネットワークをダブルクリックし、**Bend** を選んでからアンカーを選ぶと、ハンドルが表示されます。接続する辺の端がちょうど 2 つのアンカーに対し、**Handle coupling** は 3 つのモードを提供します。

-   **Independent**: 一方のハンドルを動かしても、もう一方は変わりません。
-   **Align angles**: ハンドルを互いに反対の半直線上に保ち、もう一方のハンドルの長さは維持します。
-   **Mirror angle and length**: ハンドルを反対向きで、同じ長さに保ちます。

モードを変えると、ゼロでない最初のハンドルを基準に、組がすぐに揃います。ドラッグ中に **Alt** を押し続けると結合が外れ、その後そのアンカーは独立のままになります。接続する辺の端が 3 つ以上の分岐頂点は、ハンドルを独立に保ちます。自己ループは端を 2 つとして数えます。潰れたハンドルには方向がないため、角度だけを揃える結合は、ドラッグ中のハンドルに再び方向ができるまで、もう一方のハンドルを維持します。

直線の辺は、反対側の端点を指す一時的なハンドル位置を示し、その一つをドラッグするとベジェ制御が作られます。これらのガイドは、ドラッグするまで保存された幾何を変えません。完了したドラッグまたは結合の変更 1 回が、元に戻す 1 ステップです。**Esc**、ポインタのキャンセル、キャンバスから離れること、ツールの切り替えは、保留中のドラッグをキャンセルして元の幾何を戻します。曲線の範囲が変わっても、回転、反転、スケールのもとでのアンカー位置は維持されます。

以下は [Introducing Vector Networks - Bending] からの引用です。ベジェ曲線の編集は Path と VectorNetwork の両方に共通です。

> Vector graphics today are based on cubic bezier splines, which are curves with two extra points called control handles that are positioned away from the curve itself and that control how much it bends, sort of like how a magnet might bend a wire towards it. Changing the shape of a curve involves dragging a control handle off in space instead of dragging the curve directly.

![辺の制御点](https://alexharri.com/images/posts/vector-networks/39.svg)

VectorNetwork の辺の定義では、`tangentStart` と `tangentEnd` が 3 次ベジェ曲線の 2 つの制御点を定義できます。両方が `[0, 0]` のとき、直線に退化します。

Konva の例 [How to modify line points with anchors?] や [bezierjs] も試せます。

ダブルクリックの編集モード、Move / Bend / Cut / Fill ツールバー、中点の挿入は、下の [編集モードとツールバー](#vector-edit-mode) で扱います。

![Figma のベクター編集モード](/figma-vectornetwork-mode.png)

```ts
export enum Pen {
    SELECT = 'select',
    HAND = 'hand',
    VECTOR_NETWORK = 'vector-network', // [!code ++]
}
```

[Lesson 21 - Transformer] の OBB に基づく方法とは異なります。

-   編集モードで `VectorSegment` をドラッグすると両端点が動き、それらの頂点を共有する隣接辺が自然に追従します。
-   `VectorVertex` をドラッグするとその頂点だけが動き、それを共有するすべてのセグメントが自動で追従します。これが Path に対する Vector Network の中核的な利点です。新しい座標は単一の入口 `API.updateNodeVectorNetwork(node, vectorNetwork)` を通して書き戻されます。この呼び出しはエンティティの `VectorNetwork` コンポーネントを更新し、再テッセレーションと履歴（元に戻す / やり直す）を引き起こします。

```ts
// packages/ecs/src/systems/Select.ts
// In handleControlPointMoving, for a vector-network node:
// 1. Read the VectorNetwork component and map the pointer back to local
//    space via the inverse of GlobalTransform.
// 2. Update vertices[activeIndex].x/y.
// 3. Call api.updateNodeVectorNetwork to write back.
```

書き戻しのとき、`VectorNetwork.getGeometryBounds` が幾何のバウンディングボックスを再計算し、すべての頂点を `-minX/-minY` だけずらして、左上をローカルの `(0, 0)` に正規化します。補償オフセットを `node.x/y` に加える前に、ノードのスケールと回転を適用し、オフセットを親座標系で表します。したがって基準を移しても、ワールド空間のアンカー位置は保たれます。接線はアンカーに対する相対値なので、平行移動は不要です。

### 編集モードとツールバー {#vector-edit-mode}

Figma の [Edit vector layers] に従い、`vector-network` ノードをダブルクリックすると頂点編集モードに入ります。エンティティに `Editable.isEditing = true` を設定し、下中央に **Move / Bend / Cut / Fill** ツールバー（`VectorNetworkEditMode`、`context-vector-network-edit-bar.ts` を参照）を表示します。編集を終了すると（ツールバーの閉じるボタン、Esc、空のキャンバスをクリック）、`isEditing: false` を書き込みます。`RenderTransformer` はすべての編集アンカー（頂点、セグメントの中点、接線ハンドル）を隠します。

| モード   | 操作                                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Move** | 頂点をドラッグします。セグメントにホバーすると中点が表示され、クリックすると新しい頂点が挿入されます                                  |
| **Bend** | 辺をドラッグして直接曲げるか、3 種類の結合モードでハンドルを編集します                                                                |
| **Cut**  | Move と同じ中点挿入です。**頂点をクリック**すると切断点でトポロジーを断ち、引き離してドラッグできるよう自動的に Move へ切り替わります |
| **Fill** | ホバーで閉じた面をプレビューし、クリックで穴と隣接する面を保ったままその面の塗りを切り替えます                                        |

アンカーの**ホバー強調**と**選択**は分かれています。`Transformable.hoveredControlPointIndex` はポインタが離れると消え、`selectedControlPointIndex` はクリック後も残り、空白か図形の内側をクリックするまで維持されます。

### Move: セグメントの中点に頂点を挿入する {#insert-at-midpoint}

セグメントにホバーすると、曲線の中点（`t = 0.5`。3 次の辺では曲線上の点）に中点アンカーを描画します。クリックすると `splitSegmentAt`（[作成と削除](#creation--delete) を参照）を呼び出し、辺を分割してネットワークを書き戻します。`Select.insertControlPointFromMidpoint` と `RenderTransformer.findHoveredVectorNetworkSegmentIndex`（ビューポートからローカル曲線までの距離）を参照してください。

Move は頂点 1 つか辺全体をドラッグし、接線を保ったまま両端点を動かします。回転、スケール、ミラーされたノードは、押した瞬間に取得した座標系を使い、バウンディングボックスが変わるときのずれを避けます。頂点は別の頂点の近くでスナップし、離したときに結合します。Esc、ポインタのキャンセル、ツールの切り替えは、新しく挿入した中点を含めてジェスチャ全体を戻します。Cut はクリック時にコミットされ、離しても切断されたままです。Delete はポインタが離れても、選択された頂点に作用します。

ドラッグ中の幾何の変更は、コミットされないままです。元に戻す操作とやり直す操作は、まずジェスチャ開始時の幾何を戻してから履歴を適用するため、バウンディングボックスと頂点は同じ編集のまま揃います。外部の更新が幾何や変換を置き換えた場合は、古いジェスチャを破棄します。その後の移動、離す操作、Escape では、古くなったスナップショットを戻せません。スタイルだけの変更はドラッグを中断せず、幾何をキャンセルしても新しいペイントは残ります。ドラッグ中の Delete は、まず終わっていない移動をキャンセルしてから、選択された元の頂点を削除します。対象が新しく挿入した中点なら、その挿入だけをキャンセルします。

## トポロジー演算子 {#topological-operators}

### 交差の自動分割 {#automatic-intersections}

ペンの辺をコミットするか、Move または Bend のドラッグを終えると、そのネットワーク内の横断する交差と T 字接合が接続されます。直線、3 次ベジェ、複数の交差、3 次曲線の自己交差に対応します。ド・カステリョ細分は曲線形状を保ち、領域と穴の走査は走査順に書き直されます。既存の頂点インデックスは安定したままなので、ペンの継続は引き続きクリックした端点から始まります。

ドラッグ中はトポロジーが変わりません。分割は離したときに図形の編集と一緒にコミットされ、キャンセルすると接合は残らず、元に戻す / やり直すは操作全体を対象にします。取り込んだ幾何を明示的に正規化するには `splitVectorNetworkIntersections(network)` を呼び出します。検出は適応的細分と数値的な精密化を使います。接線接触、重なる区間のブール結合、別ノード間の接続はサポートされません。端点だけが接する接触は、Cut の結果を保つために分離したままです。

Figma は [Boolean operations] をサポートします。たとえば union です。

![出典: https://help.figma.com/hc/en-us/articles/360039957534-Boolean-operations](https://help.figma.com/hc/article_attachments/30101990451607)

実装の参考として Paper.js が役立つことがあります。

### 作成と削除 {#creation--delete}

[Delete and Heal for Vector Networks]

頂点の追加: 点配列へ単純に splice する代わりに、パラメータ `t` でセグメントを 2 本に分け、新しい頂点を挿入します（3 次の辺は曲線形状を保つよう、ド・カステリョで細分します）。

```ts
export function splitSegmentAt(
    network: VectorNetworkData,
    segIdx: number,
    t: number,
): number; // Mutates network and returns the new vertex index.
```

頂点の削除: 頂点とそれに接続する辺を取り除いたあと、次数 2 の隣は 2 本の辺を 1 本にまとめて修復（heal）されるため、パスの接続が保たれます（Figma の Delete and Heal に揃えます）。編集モードで **Delete / Backspace** により実行します。

```ts
export function deleteVertex(
    network: VectorNetworkData,
    vertexIdx: number,
): VectorNetworkData;
```

> 削除、切断、結合は新しいネットワークを返します。`splitSegmentAt` は渡されたネットワークのコピーを変更し、挿入された頂点インデックスを返します。`packages/ecs/src/utils/vector-network-topology.ts` の演算子は描画から分離されており、独立してテストできます。編集システムはその結果を `API.updateNodeVectorNetwork` を通して書き戻します。

曲線の場合、Heal はまず元の細分済み 3 次曲線の復元を試みます。そうでなければ、誤差上限を検査しながら 3 次曲線を当てはめ、既定値は制御点のバウンディング範囲の 5% です。`maxError` はローカル単位の許容誤差を設定します。許容誤差を満たせないときは、元のネットワークを保持します。**Shift + Delete / Backspace** は修復せずに頂点と接続する辺を取り除きます。分割と編集は走査順に境界インデックスを割り当て直し、有効な領域を保持します。

### Glue と Unglue {#glue-unglue}

![Glue と Unglue 演算子](/vgc-operator-glue-unglue.png)

**Move** で頂点を選び、**Glue / Unglue**（鎖のアイコン）をクリックします。パネルはキャンバス上で頂点を **V1, V2, …**、接続する辺を **E1, E2, …** と表示します。

-   **Glue**: 対象頂点を選んで確定します。選択した頂点が対象へ移動し、接続がまとまります。異なる曲線と曲線の自己ループは残り、同一の辺は 1 本にまとまります。
-   **Unglue**: 切り離す辺の端にチェックを入れて確定します。同じ位置に新しい頂点が作られ、その端だけが接続されます。選択状態になるので、すぐにドラッグして引き離せます。元の頂点には少なくとも 1 つの端を残します。自己ループの始点と終点は別々に選べます。

立方体の正面右上の接合を選び、**Glue / Unglue** を開いて **E7 · Start** を切り離してみてください。選択された複製をドラッグして引き離し、**V3** を対象に **Glue** すると元へ戻せます。

<VectorNetworkCube topology />

プレビューはドキュメントを変更しません。Cancel は幾何を変えずに閉じます。外部の幾何更新、元に戻す操作、編集モードを離れることは、保留中の操作を無効にします。確定した操作 1 回が、元に戻す 1 ステップです。Unglue は曲線の幾何と、まだ閉じている領域を保ちます。外側境界や穴を開くと、影響を受けた塗り領域全体が取り除かれます。Glue は接続を戻しますが、取り除かれた塗りを自動では戻しません。Fill を再度使うか、Undo で以前の完全な状態を戻してください。

`glueVertices(network, source, target)` と `unglueVertex(network, vertex, endpoints)` は `VectorTopologyResult` を返します。失敗理由か、新しいネットワーク、頂点 / セグメントのインデックス対応、選択された頂点インデックスです。端点は `{ segmentIndex, end: 'start' | 'end' }` を使います。API のインデックスは 0 始まりです。入力は変更されません。この最初の段階は 1 つのネットワーク内の頂点を対象とし、共有辺と面の操作は下で説明します。

#### 共有辺の Glue / Unglue {#shared-edge-glue-unglue}

**Move** で端点を選び、**Glue / Unglue** を開いて **Topology target** を **Edges** に設定します。**Source edge** を選ぶと、それに接する塗られた領域が **R1, R2, …** と表示されます。チェックした領域は強調されます。境界での使用は **R（領域）· L（ループ）· ループ内の位置** と表示され、番号はすべて 1 始まりです。

下の立方体には塗られた面が 3 つあります。正面右上の頂点 **V3** を選び、**Unglue edge → E7** を選んで **R2 · L1 · 4**（上面）にチェックを入れ、確定します。上面はその複製 **E10** を使い、右面は引き続き **E7** を使います。Unglue は自動で **Bend** に入ります。対角線の中央をドラッグすると、複製と上面の境界だけが曲がります。両端点は共有されたままです。重なっている元の辺を編集するには Move に戻り、Edges パネルで E7 を選んで **Bend selected edge** をクリックします。

<VectorNetworkCube edges />

曲げを元に戻して曲線を再び重ね、Move に戻って V3 を選びます。Edges パネルで **Glue edges** を選び、**E10** を **E7** に結合します。Glue は格納方向が逆の場合にも対応し、インデックスが違っても位置が一致する端点頂点を溶接します。要求したソース辺だけが取り除かれ、関係のない重複は残ります。曲線や制御点が一致しない場合、端点が両立しない場合、同じ境界ループで 2 本の辺を使う場合、nonzero の塗りを変えうる部分的なワインディング反転は拒否されます。

Unglue は曲線の幾何、端点、穴を含むすべての領域を保ち、選択した境界での使用だけを複製へ移します。元の辺には使用が少なくとも 1 つ残らなければなりません。現在、領域は塗られた境界を格納します。辺にはそのような使用が少なくとも 2 つ必要なので、必要なら先に隣接する面を塗ってください。Fill は、取り込んだ広い領域を別々の面へ正規化できます。複製がまだ重なっている間は Bend か Glue を使ってください。Fill と面の Cut / Uncut は、引き続き平面埋め込みを仮定します。Glue / Unglue のそれぞれが、元に戻す 1 ステップです。プレビューと **Bend selected edge** は履歴項目を作りません。

純粋関数 `vectorEdgeUses(network, edge)` は `{ regionIndex, loopIndex, offset }` の項目を返します。`unglueVectorNetworkEdge(network, edge, uses)` と `glueVectorNetworkEdges(network, source, target)` は `VectorEdgeTopologyResult` を返します。新しいネットワーク、頂点 / 辺のインデックス対応、選択された辺か、失敗理由です。API のインデックスは 0 始まりで、入力は変更されません。

### Cut と Uncut {#cut-uncut}

![Cut と Uncut 演算子](/vgc-operator-cut-uncut.png)

#### 面の分割と結合 {#split-and-merge-faces}

**Move** で頂点を選び、**Cut / Uncut faces**（分割されたパスのアイコン）をクリックします。**Cut face** は同じ面の境界頂点を直線の継ぎ目でつなぎ、穴への接続や穴どうしの接続を含みます。**Uncut edge** は隣接する面の間の共有辺、または境界成分をつなぐ継ぎ目を取り除きます。頂点の位置と既存の曲線制御点は変わりません。両方の操作は 1 ステップの Undo / Redo に対応します。

下の塗られた正面を試してください。**左下の頂点 V1** を選び、**Cut face → V3** を選んで確定します。新しい対角線 **E10** が青い面を、塗られた三角形 2 つに分けます。パネルを再び開き、**Uncut edge → E10** を選んで確定すると、元に戻ります。Fill で三角形 1 つの塗りを消せます。そのとき Uncut は、塗られた範囲が不意に変わる代わりに、両側の塗り状態が同じでなければならないと説明します。

<VectorNetworkCube faces />

Cut は平面の面の内側に留まらなければなりません。別の辺を横切るか触れる場合、辺と重なる場合、穴を通過する場合は拒否されます。既存の曲線境界と両側の穴は保たれます。現在の Cut は、任意に描いた曲線ではなく直線の継ぎ目を使います。Uncut が有界な面 2 つを結合するときは、両方とも塗られているか、両方とも塗られていない必要があります。穴の境界をつなぐ継ぎ目を取り除くと、元の塗りが保たれます。ぶら下がったストロークは、境界をつなぐ継ぎ目としては取り除かれません。プレビューは一時的です。Cancel、Undo、選択頂点の変更、外部の幾何更新はプレビューを破棄します。拒否された操作は理由を説明し、履歴項目を作りません。

純粋関数 `cutVectorNetworkFace(network, from, to)` と `uncutVectorNetworkEdge(network, edgeIndex)` は `VectorFaceTopologyResult` を返します。失敗理由、または新しいネットワーク、頂点 / 辺のインデックス対応、選択された頂点を含みます。インデックスは 0 始まりです。塗られた領域は最小の平面の面へ正規化され、見えている塗られた範囲と穴を保ちます。この面の操作は、下で説明する、頂点を開く既存の Cut ツールとは別です。

#### 穴の境界をつなぐ {#connecting-hole-boundaries}

下の環には塗られていない穴があります。Move で外側の左上隅 **V1** を選び、**Cut / Uncut faces** を開いて **Cut face → V5** を選びます。新しい **E9** が外側境界を穴へつなぎます。青い領域は 1 つの面のままで、穴は透明のまま、境界は E9 を各方向に 1 回ずつ通ります。

続いて外側の右上隅 **V2** を選び、**Cut face → V6** を選びます。新しい **E10** が環を、Fill で別々に切り替えられる 2 つの面に分けます。塗りを変えずに V2 を選んで **Uncut edge → E10** を実行し、次に V1 を選んで **Uncut edge → E9** を実行すると、境界ループが 2 つに分かれた環に戻ります。各ステップは、元に戻す操作とやり直す操作に対応します。

<VectorNetworkFaceCut />

継ぎ目全体が同じ面の内側にあり、他の境界に触れなければ、2 つの穴もつなぐことができます。異なる境界をつなぐと面は増えず、境界ループが 1 つ減ります。1 つの境界の内側で切ると面が 1 つ増えます。既存の曲線境界は変わらず、塗りは覆っている範囲を保ったまま `evenodd` の面領域へ正規化されます。

#### 頂点を開く {#open-a-vertex}

Cut は**選択した頂点でトポロジーを断ちます**。その頂点を複製し、最初に接続する端点は残して、残りの端点を複製へ移します。閉じたループと開いた鎖は同じ規則を使います。三角形 `0—1—2—0` で頂点 `1` を切る場合は次のとおりです。

```plaintext
Before:  0 — 1 — 2 — 0 (closed)
After:   1 — 0 — 2 — 3 (3 coincident with 1, open polyline)
segments: [0,1], [3,2], [2,0]
```

開いたポリラインでは**切った頂点を複製**し、最初に接続する辺以外を複製へ割り当て直して、2 本の鎖を Move モードで引き離せるようにします。`breakVertex` を参照してください。

```ts
export function breakVertex(
    network: VectorNetworkData,
    vertexIndex: number,
): VectorNetworkData | null;
```

Cut モードで頂点をクリックすると `breakVectorNetworkAtVertex`（`Select.ts`）を呼び出し、ネットワークを書き戻し、履歴を記録し、`setAppState({ vectorNetworkEditMode: MOVE })` によりすぐにドラッグできます。境界が閉じたままの領域は保持されます。無効な境界は、それを含む領域を取り除きます。穴が切れるときも同様で、その穴を誤って塗らないためです。空にするときは明示的に `regions: []` を書き、エンティティと元に戻す履歴がずれないようにします。頂点 1 つの 3 次自己ループも切ることができます。

## さらに読む {#extended-reading}

-   [Introducing Vector Networks]
-   [The Engineering behind Figma's Vector Networks]
-   [Vector Graphics Complexes]
-   [图形编辑器开发：钢笔工具的实现]
-   [vpaint]
-   [penpot]

[Introducing Vector Networks]: https://www.figma.com/blog/introducing-vector-networks/
[Introducing Vector Networks - Bending]: https://www.figma.com/blog/introducing-vector-networks/#bending
[Delete and Heal for Vector Networks]: https://www.figma.com/blog/delete-and-heal-for-vector-networks/
[VectorNetwork API]: https://www.figma.com/plugin-docs/api/VectorNetwork/
[VectorPath API]: https://www.figma.com/plugin-docs/api/VectorPath/
[VectorPath-data]: https://www.figma.com/plugin-docs/api/properties/VectorPath-data/
[Vector Graphics Complexes]: https://www.borisdalstein.com/research/vgc/
[The Engineering behind Figma's Vector Networks]: https://alexharri.com/blog/vector-networks
[Discussion in HN]: https://news.ycombinator.com/item?id=39241825
[vpaint]: https://github.com/dalboris/vpaint
[penpot]: https://github.com/penpot/penpot
[图形编辑器开发：钢笔工具的实现]: https://zhuanlan.zhihu.com/p/694407842
[Lesson 12 - Draw polyline]: /ja/guide/lesson-012
[Lesson 13 - Drawing path and sketchy style]: /ja/guide/lesson-013
[fillRule]: /ja/guide/lesson-013#fill-rule
[How to modify line points with anchors?]: https://konvajs.org/docs/sandbox/Modify_Curves_with_Anchor_Points.html
[bezierjs]: http://pomax.github.io/bezierjs
[figma-fill-rule-editor]: https://github.com/evanw/figma-fill-rule-editor
[Polyline]: /ja/guide/lesson-012
[Lesson 21 - Transformer]: /ja/guide/lesson-021
[Edit vector layers]: https://help.figma.com/hc/en-us/articles/360039957634-Edit-vector-layers#h_01JYM29VEN8ABWTDXJR529446R
[Boolean operations]: https://help.figma.com/hc/en-us/articles/360039957534-Boolean-operations
