---
outline: deep
description: 'コネクタを図形にバインドし、ノードが移動するとエッジが追従するようにします。直交、曲線、矢印のバインディングを含みます。'
head:
    - [
          'meta',
          { property: 'og:title', content: '第31課 - 図形間のバインディング' },
      ]
---

<script setup>
import Binding from '../../components/Binding.vue'
import BindingWithEllipse from '../../components/BindingWithEllipse.vue'
import BindingOrthogonal from '../../components/BindingOrthogonal.vue'
import BindingConstraint from '../../components/BindingConstraint.vue'
import BindingRouteOrthConnector from '../../components/BindingRouteOrthConnector.vue'
import BindingRounded from '../../components/BindingRounded.vue'
import BindingCurved from '../../components/BindingCurved.vue'
import BindingBezier from '../../components/BindingBezier.vue'
import BindingArrow from '../../components/BindingArrow.vue'
import BindingDangling from '../../components/BindingDangling.vue'
import BindingLoop from '../../components/BindingLoop.vue'
</script>

# 第 31 課 - 図形間のバインディング {#lesson-31-bindings-between-shapes}

[第 23 課 - マインドマップ]では、ノードとエッジのレイアウトアルゴリズムだけを扱い、ノードを動かしたときにエッジも動くといったインタラクションには踏み込んでいませんでした。同様に、[第 25 課 - 矢印を描く]では、線と矢印のプロパティにバインディング情報は含まれていませんでした。この課でその機能を完成させます。

## データ構造 {#data-structure}

### excalidraw の線形要素 {#excalidraw-linear-element}

Excalidraw では、接続線（矢印など）はデータモデル上で `ExcalidrawLinearElement` として表され、接続に関するフィールドが追加されます。

```ts
export declare type PointBinding = {
    elementId: ExcalidrawBindableElement['id'];
    focus: number;
    gap: number;
};
export declare type ExcalidrawLinearElement = _ExcalidrawElementBase &
    Readonly<{
        type: 'line' | 'arrow';
        points: readonly Point[];
        lastCommittedPoint: Point | null;
        startBinding: PointBinding | null;
        endBinding: PointBinding | null;
        startArrowhead: Arrowhead | null;
        endArrowhead: Arrowhead | null;
    }>;
```

上に示したとおり、各矢印には省略可能な `startBinding` と `endBinding` のフィールドがあり、これらは `points` とは意味の階層が異なります。前者は意味的な制約であり、後者の `points` は幾何学的な表現です。両方が同時にあるときは、`points` を再計算する必要があります。さらに、始点と終点の矢印スタイル（`startArrowhead/endArrowhead`）があります。`elementId` は `PointBinding` の中で接続先の図形（矩形、楕円、テキスト、画像など、バインド可能な要素）を指し、`focus` と `gap` は接続位置を決めるために使います（浮動小数点のインデックスとオフセット距離）。たとえば、次は JSON における矢印要素の例です。

```ts
{
  "type": "arrow",
  // ... other properties omitted ...
  "startBinding": {
    "elementId": "xw25sQBsbd2mecyjTrYHA",
    "focus": -0.0227,
    "gap": 15.6812
  },
  "endBinding": null,
  "points": [[0,0],[0,109]],
  "startArrowhead": null,
  "endArrowhead": null
}
```

この例では、矢印の `startBinding` は ID が `"xw25sQBsbd2mecyjTrYHA"` の図形を指し、`focus` と `gap` はその図形の境界から始まる接続位置を定義します。

同時に、バインドされた各図形（矩形や楕円など）の基本データ構造には `boundElements` のリストがあり、その図形に接続されたすべての矢印やテキスト要素を記録します。このフィールドの型は通常 `{ id: ExcalidrawLinearElement["id"]; type: "arrow"|"text"; }[] | null` です。つまり、矢印と図形の接続は双方向に維持されます。矢印は自分がバインドする対象要素の ID を記録し、対象要素は自分を指す矢印の ID を記録します。

### tldraw のバインディング {#tldraw-binding}

tldraw では「接続線」自体も図形であり（デフォルトは矢印の図形）、接続関係は Binding オブジェクトで表します。各バインディングレコードはストレージに別個に存在し、2 つの図形の間の関連を表します。矢印の接続には `TLArrowBinding` 型を使い、これは `TLBaseBinding<'arrow',TLArrowBindingProps>` の特殊化です。典型的な矢印バインディングレコードの例は次のとおりです。

```ts
{
  id: 'binding:abc123',
  typeName: 'binding',
  type: 'arrow',           // Binding type is arrow
  fromId: 'shape:arrow1',  // Arrow shape ID (arrow shape departure end)
  toId:   'shape:rect1',   // Target shape ID (shape the arrow points to)
  props: {
    terminal: 'end',       // Which end of the arrow to bind to (start or end)
    normalizedAnchor: { x: 0.5, y: 0.5 }, // Normalized anchor point on target shape
    isExact: false,        // Whether arrow enters inside target shape
    isPrecise: true,       // Whether to use anchor point precisely, otherwise use shape center
    snap: 'edge',          // Snap mode (such as edge snapping)
  },
  meta: {}
}
```

ここで `fromId/toId` フィールドは図形 ID によって矢印と対象を関連付け、`props` には接続の詳細（アンカーポイント、整列オプションなど）が格納されます。

### antv/g6 {#antv-g6}

接続関係は幾何ではなく論理であり、経路は `type` とエッジのルーティングアルゴリズムで計算します。

```ts
interface EdgeConfig {
    id?: string;
    source: string; // Source node ID
    target: string; // Target node ID

    sourceAnchor?: number; // Source node anchor index
    targetAnchor?: number; // Target node anchor index

    type?: string; // line / polyline / cubic / loop ...
    style?: ShapeStyle;
}
```

アンカーはノード上で宣言し、座標は正規化されています。

```ts
anchorPoints: [
    [0.5, 0], // top
    [1, 0.5], // right
    [0.5, 1], // bottom
    [0, 0.5], // left
];
```

エッジではアンカーのインデックスを使います。tldraw の `normalizedAnchor` とよく似ていますが、G6 はアンカー定義の権限をノード側に置きます。

```ts
{
    source: 'nodeA',
    target: 'nodeB',
    sourceAnchor: 1,
    targetAnchor: 3,
}
```

### mxGraph {#mxgraph}

mxGraph には完全な接続制約システムがあり、ノードの図形上に定義されて、接続を許す点を表します。

```ts
class mxConnectionConstraint {
    point: mxPoint | null; // (0.5, 0) = top center (1, 0.5) = right center
    perimeter: boolean; // Indicates projection along shape boundary
}
```

### JSON Canvas Spec {#json-canvas-spec}

Obsidian は [JSON Canvas Spec] を公開しています。構造は `antv/g6` と似ており、トップレベルにノードとエッジの配列を格納します。

```json
{
    "nodes": [],
    "edges": []
}
```

エッジは次のようになります。幾何は持たず、論理的な接続だけを持ちます。

```json
{
    "id": "f67890123456789a",
    "fromNode": "6f0ad84f44ce9c17",
    "toNode": "a1b2c3d4e5f67890"
}
```

## 私たちの設計 {#our-design}

スキーマでは mxGraph のやり方に寄せています。エッジ上の論理関係は `fromId` と `toId` で表すので、`x1/y1` のような幾何フィールドは必要ありません。`rect-1` と `rect-2` をつなぐ矢印は、次のように宣言します。

```ts
const edge1 = {
    id: 'line-1',
    type: 'line',
    fromId: 'rect-1',
    toId: 'rect-2',
    stroke: 'black',
    strokeWidth: 10,
    markerEnd: 'line',
};
```

制約はノード上にあり、[mxConnectionConstraint] と似ています。

```ts
interface ConstraintAttributes {
    /**
     * Normalized point, relative to bounding box top-left.
     */
    point: [number, number];
    /**
     * Use perimeter.
     */
    perimeter: boolean;
    name?: string;
    dx?: number;
    dy?: number;
}
```

[第 18 課 - 親子コンポーネントの定義] と同様に、双方向のバインディング関係を実装できます。

```ts
class Binding {
    @field.ref declare from: Entity;
    @field.ref declare to: Entity;
}

class Binded {
    @field.backrefs(Binding, 'from') declare fromBindings: Entity[];
    @field.backrefs(Binding, 'to') declare toBindings: Entity[];
}
```

### 特殊な場合 {#special-case}

次の課では、`fromId/toId` が null になり得る特殊な場合に出会います。下のシーケンス図の破線がそれを示しており、`fromId: 'alice', toId: undefined` です。

![D2 のシーケンス図](/d2.png)

関連するノードが片方だけの関係を記録する、新しいコンポーネントを導入します。

```ts
/**
 * Edge with only one end attached to a shape; the other end is fixed by `sourcePoint` / `targetPoint`.
 * `attached` is the entity on the connected side; `sourceIsAttached === 1` means the connection is on the source (`fromId`) side.
 */
class PartialBinding {
    @field.ref declare attached: Entity;
    /** 1 = source (from) side attached to node, 0 = target (to) side */
    @field.int32 declare sourceIsAttached: number;
}
```

<BindingDangling />

## 自動更新 {#auto-update}

接続された図形の位置が変わると、バインドされたエッジの経路を再計算する必要があります。`Binded` コンポーネントを持つすべての図形を問い合わせ、バウンディングボックスの変化を監視し、その時点でバインドされたエッジを更新できます。

```ts
class RenderBindings extends System {
    private readonly boundeds = this.query(
        (q) => q.with(Binded).changed.with(ComputedBounds).trackWrites,
    );

    execute() {
        const bindingsToUpdate = new Set<Entity>();
        this.boundeds.changed.forEach((entity) => {
            const { fromBindings, toBindings } = entity.read(Binded);
            [...fromBindings, ...toBindings].forEach((binding) => {
                bindingsToUpdate.add(binding);
            });
        });
        // Recalculate paths of bound edges and render
    }
}
```

下の例ではノードをドラッグしてみることができ、エッジは経路を再計算して描き直します。

<Binding />

現在、エッジの始点と終点は接続された図形のバウンディングボックスの中心であり、tldraw で `isPrecise` が `false` のときの効果と一致します。これは精密でないバインディングを表します。
ほとんどの場合、矢印が接続された図形を貫かず、図形の端にきれいに接してほしいところです。

## 境界アルゴリズム {#perimeter}

図形の境界について、drawio は `perimeter` プロパティを提供しており、これを変えると接続に影響します。詳しくは [Change the shape perimeter] を参照してください。

![境界スタイルとポート制約](https://drawio-app.com/wp-content/uploads/2019/02/drawio-perimeter-constraint-styles.png)

```ts
// Note: generally next is passed as "the other center point", orthogonal is usually false
var pointA = graph.view.getPerimeterPoint(stateA, centerB, false, 0);
var pointB = graph.view.getPerimeterPoint(stateB, centerA, false, 0);
```

### 矩形の境界アルゴリズム {#rectangle-perimeter}

矩形の境界アルゴリズムが最もよく使われます。次の実装で `vertex` はソースノード、`next` はターゲットノードのバウンディングボックスの中心です。
まずソースノードとターゲットノードのバウンディングボックスの中心を結ぶ線を引き、ターゲット点がソースノードのバウンディングボックスのどの辺に近いかを判定します。バウンディングボックスの 2 本の対角線が平面を 4 つの領域に分けます。左境界の範囲は $[-\pi+t, \pi-t]$ の外側の領域です（つまり、コード中の `alpha < -pi + t || alpha > pi - t` という判定）。

```ts
function rectanglePerimeter(
    vertex: SerializedNode,
    next: IPointData,
    orthogonal: boolean,
): IPointData {
    const { x, y, width, height } = vertex;
    const cx = x + width / 2; // Source node center
    const cy = y + height / 2;
    const dx = next.x - cx;
    const dy = next.y - cy;
    const alpha = Math.atan2(dy, dx); // Slope of line from source node center to target node center
    const p: IPointData = { x: 0, y: 0 };
    const pi = Math.PI;
    const pi2 = Math.PI / 2;
    const beta = pi2 - alpha;
    const t = Math.atan2(height, width); // Diagonals divide into four regions
    if (alpha < -pi + t || alpha > pi - t) {
        // Intersects with left edge
        p.x = x;
        p.y = cy - (width * Math.tan(alpha)) / 2; // Calculate intersection point
    }
    // Other three edges omitted
    return p;
}
```

最後に、その線とその辺との交点を、最終的な線の出発点として計算します。たとえば、線が「左の辺」を通ると判定したとき：

1. $x$ 座標を決めます。左の辺なので、交点の $x$ 座標は矩形の左境界の値 `vertex.x` と等しくなければなりません。
2. $y$ のオフセットを計算します。
    1. 中心から左の辺までの水平距離は `width / 2` です。
    2. 正接の公式を使います。$\tan(\alpha) = \frac{\Delta y}{\Delta x}$。
    3. 左側では $\Delta x = -(\text{width} / 2)$ です。
    4. したがって垂直オフセットは $\Delta y = \Delta x \cdot \tan(\alpha) = -\frac{\text{width}}{2} \cdot \tan(\alpha)$ です。
3. 最終座標は `p.y = cy + Δy` であり、コードでは `cy - (width * Math.tan(alpha)) / 2` です。

draw.io は別のオプション `orthogonal` も提供します。計算した線を直交に揃える必要があるという意味です（つまり、x 軸または y 軸に揃えます）。線は水平または垂直の延長だけを考慮します。この場合、相手の中心点を基準にはできません。

```ts
if (orthogonal) {
    if (next.x >= x && next.x <= x + width) {
        p.x = next.x;
    } else if (next.y >= y && next.y <= y + height) {
        p.y = next.y;
    }
    if (next.x < x) {
        p.x = x;
    } else if (next.x > x + width) {
        p.x = x + width;
    }
    if (next.y < y) {
        p.y = y;
    } else if (next.y > y + height) {
        p.y = y + height;
    }
}
```

<BindingOrthogonal />

### 楕円の境界アルゴリズム {#ellipse-perimeter}

楕円ノードでは、線との交点を計算する必要があります。

```ts
const d = dy / dx;
const h = cy - d * cx;
const e = a * a * d * d + b * b;
const f = -2 * cx * e;
const g = a * a * d * d * cx * cx + b * b * cx * cx - a * a * b * b;
const det = Math.sqrt(f * f - 4 * e * g);

const xout1 = (-f + det) / (2 * e);
const xout2 = (-f - det) / (2 * e);
const yout1 = d * xout1 + h;
const yout2 = d * xout2 + h;
const dist1 = Math.sqrt(Math.pow(xout1 - px, 2) + Math.pow(yout1 - py, 2));
const dist2 = Math.sqrt(Math.pow(xout2 - px, 2) + Math.pow(yout2 - py, 2));

let xout = 0;
let yout = 0;
if (dist1 < dist2) {
    xout = xout1;
    yout = yout1;
} else {
    xout = xout2;
    yout = yout2;
}
return { x: xout, y: yout };
```

線は中心 $(cx, cy)$ を通り、その方程式は $y = d \cdot x + h$ です。

-   傾き $d = \frac{dy}{dx}$
-   切片 $h = cy - d \cdot cx$

直線の方程式を楕円の標準方程式に代入します。

$$\frac{(x-cx)^2}{a^2} + \frac{(d \cdot x + h - cy)^2}{b^2} = 1$$

展開して整理し、$x$ についての二次方程式 $ex^2 + fx + g = 0$ にします。コード中の e、f、g は次に対応します。

-   $e$: 2 次の係数
-   $f$: 1 次の係数
-   $g$: 定数項

解の公式：判別式 $det = \sqrt{f^2 - 4eg}$ を使って、2 つの交点 $xout1$ と $xout2$ を計算します。点を 1 つ選びます。楕円を通る半直線は交点を 2 つ作ります（手前に 1 つ、奥に 1 つ）。コードは両方の交点からターゲット点 `next` までの距離（dist1 と dist2）を計算し、より近い点を選びます。

<BindingWithEllipse />

## 制約 {#constraint}

ここまでで、エッジ上の論理接続を `fromId` と `toId` だけで実装しました。エッジとノードの接続点は浮動しており、mxGraph では `FloatingTerminalPoint` と呼びます。しかし、エッジがノード上の固定位置から出発し、接続先の図形の固定位置へ入ってほしいこともあります。mxGraph ではこれを `FixedTerminalPoint` と呼びます。その場合は制約を定義する必要があり、処理をノードとエッジに分けます。

### ノード上の制約 {#constraint-on-node}

ノードの制約は、どこから、どのような規則で接続できるかを定義します。それは「点」ではなく規則オブジェクトであり、mxGraph では次のように定義されます。

```ts
class mxConnectionConstraint {
    point: mxPoint | null; // Normalized coordinates (0~1)
    perimeter: boolean; // Whether to project onto the boundary
    name?: string; // Optional port name
}
```

付属の draw.io エディタでは、図の上に多数の「青い接続点」が見えます。これらは、図上の制約をオーバーライドすることで定義されます。

```ts
mxRectangleShape.prototype.getConstraints = function (style) {
    return [
        new mxConnectionConstraint(new mxPoint(0.5, 0), true), // top
        new mxConnectionConstraint(new mxPoint(1, 0.5), true), // right
        new mxConnectionConstraint(new mxPoint(0.5, 1), true), // bottom
        new mxConnectionConstraint(new mxPoint(0, 0.5), true), // left
    ];
};
```

私たちの制約は次のように定義します。ノード上に制約の集合を宣言できます。

```ts
export interface ConstraintAttributes {
    x?: number;
    y?: number;
    perimeter?: boolean;
    dx?: number;
    dy?: number;
}

export interface BindedAttributes {
    constraints: ConstraintAttributes[];
}
```

候補の制約を取得し、最も近い制約を選び、その制約を幾何学的な点へ変換します。境界への射影が必要なら、前の節で紹介した境界アルゴリズムの計算へ進みます。

### エッジ上の制約 {#constraint-on-edge}

エッジがノードのどのアンカーポイントから出るか、または入るかも定義する必要があります。インタラクション上は、エッジの端点をノードのアンカーポイントへドラッグすることに対応します。このとき `entryX/entryY` は、アンカーポイント制約の `x/y` フィールドをコピーしなければなりません。

```ts
interface BindingAttributes {
    fromId: string;
    toId: string;
    orthogonal: boolean;
    exitX: number; // [!code ++]
    exitY: number; // [!code ++]
    exitPerimeter: boolean; // [!code ++]
    exitDx: number; // [!code ++]
    exitDy: number; // [!code ++]
    entryX: number; // [!code ++]
    entryY: number; // [!code ++]
    entryPerimeter: boolean; // [!code ++]
    entryDx: number; // [!code ++]
    entryDy: number; // [!code ++]
}
```

次の例では、灰色と緑の矩形に、それぞれアンカーポイント `[1, 0]` と `[0, 1]` を定義しています。

端点座標 `exitX/exitY` と `entryX/entryY` は有限の数でなければなりません。どちらかの座標が無効なら、端点は有限でない経路を生成せず、図形の境界へ戻ります。無効なピクセルオフセット（`exitDx/exitDy` または `entryDx/entryDy`）は無視され、有効なアンカーは固定されたままです。

矢印ツールで 1 回クリックしてソースを選び、ポインタを動かして接続をプレビューします。プレビューは水平方向と垂直方向の移動に追従し、どちらかの端点が空のキャンバス上にあるときも同様です。もう一度クリックすると確定し、Escape を押すと取り消します。

<BindingConstraint />

## ルーティング規則 {#routing rules}

mxGraph は EdgeStyle 関数でルーティング規則を実装します。これらの関数は次を担当します。

-   出口方向を自動的に選びます
-   経由点を挿入します
-   ノードのバウンディングボックスを避けます
-   直交／直角の経路を計算します

![コネクタスタイル](https://drawio-app.com/wp-content/uploads/2019/02/drawio-connector-styles.png)

| コネクタ         | 特徴                                               | 用途                                              |
| ---------------- | -------------------------------------------------- | ------------------------------------------------- |
| OrthConnector    | 複雑な制約に対応し、直交エッジを自動生成します     | フローチャートや組織図など、自動レイアウトの場面  |
| SegmentConnector | ユーザー定義の制御点に対応し、柔軟で対話的です     | 直交エッジの経路を手で調整するとき                |
| ElbowConnector   | L 字型の折れ点が 1 つ                              | 単純な 2 区間の経路（パンくずナビゲーションなど） |
| SideToSide       | 水平方向を優先する接続                             | ソースとターゲットのノードが水平に並ぶとき        |
| TopToBottom      | 垂直方向を優先する接続                             | ソースとターゲットのノードが垂直に並ぶとき        |
| EntityRelation   | データベースの関係図向けで、柔軟な経路を生成します | データベースの ER 図、双方向の関係                |
| Loop             | 自己ループ接続を実装します                         | 状態図やオートマトン図の自己ループ関係            |

### OrthConnector {#orth-connector}

[OrthConnector] は最も一般的なルーティングアルゴリズムで、中心となる目標は、ソースノードとターゲットノードの間に水平線分と垂直線分だけからなる経路を作り、斜め線を避けることです。具体的な手順は次のとおりです。

1. ソースとターゲットの出口／入口の方向を決めます
2. 方向の組み合わせに基づき、定義済みのルーティングパターンを探します
3. ルーティングパターンを適用し、折れ点の列を生成します
4. 障害物回避と最適化を処理します

```ts
┌──────┐        ┌──────┐
│ Node │ ─┐     │ Node │
└──────┘  └────▶└──────┘
```

<BindingRouteOrthConnector />

#### 優先ポートの選択 {#preferred-port-selections}

まず、ポート制約がない場合を考えます。最初の手順は、ソースに対するターゲットの象限位置を決めることです。両者の幾何学的な中心点を比較すると、次が得られます。

```ts
// 0 | 1
// -----
// 3 | 2

let dx = sourceCenX - targetCenX;
let dy = sourceCenY - targetCenY;
let quad = 0;
if (dx < 0) {
    if (dy < 0) {
        quad = 2;
    } else {
        quad = 1;
    }
}
// Other circumstances omitted.
```

次が最も複雑な部分です。エッジがソースノードからどの方向へ出て、ターゲットノードへどの方向から入るかを決めます。

まず、ノード間の距離を計算します。

```ts
        sourceTopDist
             ↑
    [Source] |
             ↓
        sourceBottomDist
             ↑
             | [Target]

sourceLeftDist ← [Source] → sourceRightDist → [Target]
```

そのあと、空きがより大きい方向を優先する戦略で、優先方向を決めます。

-   左までの距離 ≥ 右までの距離なら、ソースノードは西（左）へ進むのを優先します。
-   上までの距離 ≥ 下までの距離なら、ソースノードは北（上）へ進むのを優先します。
-   ターゲットノードの優先方向は、ソースノードの反対方向です。

```ts
var dirPref = [];
var horPref = [];
var vertPref = [];

horPref[0] =
    sourceLeftDist >= sourceRightDist
        ? mxConstants.DIRECTION_MASK_WEST
        : mxConstants.DIRECTION_MASK_EAST;
vertPref[0] =
    sourceTopDist >= sourceBottomDist
        ? mxConstants.DIRECTION_MASK_NORTH
        : mxConstants.DIRECTION_MASK_SOUTH;

horPref[1] = mxUtils.reversePortConstraints(horPref[0]);
vertPref[1] = mxUtils.reversePortConstraints(vertPref[0]);

var preferredHorizDist =
    sourceLeftDist >= sourceRightDist ? sourceLeftDist : sourceRightDist;
var preferredVertDist =
    sourceTopDist >= sourceBottomDist ? sourceTopDist : sourceBottomDist;
```

#### ルートパターンの選択 {#choose-route-patterns}

ソースとターゲットの方向インデックスに基づき、品質を保つように定義済みの `routePatterns` からルートパターンを選びます。ビットマスクで符号化します。

-   下位 4 ビット: 方向（1=西、2=北、4=東、8=南）
-   5-8 ビット: エッジのどの側か
-   第 9 ビット: 中心点を使うか
-   第 10 ビット: ソースノードに関連付けるか
-   第 11 ビット: ターゲットノードに関連付けるか

```ts
routePatterns: [
    [ [ 513, 2308, 2081, 2562 ], [ 513, 1090, 514, 2184, 2114, 2561 ],
        [ 513, 1090, 514, 2564, 2184, 2562 ],
        [ 513, 2308, 2561, 1090, 514, 2568, 2308 ] ],
    // ... more patterns
],
```

#### 経由点の生成 {#generate-waypoints}

ルーティングパターンを走査し、方向に基づいて実際の経路点を生成します。

```ts
for (var i = 0; i < routePattern.length; i++)
{
    var nextDirection = routePattern[i] & 0xF;

    // Rotate the index of this direction by the quad
    var directionIndex = nextDirection == mxConstants.DIRECTION_MASK_EAST ? 3
            : nextDirection;

    directionIndex += quad;

    if (directionIndex > 4)
    {
        directionIndex -= 4;
    }
```

最後に、ごく近くにある隣接した経路点を単純化します。このために、[第 12 課 - ポリラインの単純化] と同じく [simplify-js] を引き続き使います。

### SegmentConnector {#segment-connector}

OrthConnector は自動ルーティング寄りです。ユーザーが制御点 `controlHints` を明示すると、SegmentConnector はそのヒントを、必ず通過するか整列すべき経由点に変え、結果のポリラインはおおむねこれらのヒントを中心に組み立てられます。そのため、対話的な編集ではより予測しやすく、一貫します。

### LoopConnector {#loop-connector}

始点と終点が一致するときは、自己ループが必要です。

<BindingLoop />

## コネクタの線スタイル {#connectors-style}

![出典: https://www.drawio.com/doc/faq/connector-styles](https://www.drawio.com/assets/img/blog/style-tab-line-style.png)

### 角丸 {#rounded}

角丸とは、先に計算したポリラインの経由点はそのまま使い、継ぎ目の鋭い角を滑らかな遷移に置き換えることです。手順は次のとおりです。

-   ポリラインの各折れを順にたどります。
-   各角の両側で、線分に沿って後退します（最大で線分の長さの半分）。
-   `quadTo`（または同等の曲線コマンド）で、角に滑らかなフィレットを描きます。

<BindingRounded />

### 2 次ベジェ {#curved}

2 次ベジェ線分で、隣接する制御点をつなぎます。

```ts
const p0 = pts[n - 2];
const p1 = pts[n - 1];
parts.push(
    `Q ${formatNumber(p0.x)} ${formatNumber(p0.y)} ${formatNumber(
        p1.x,
    )} ${formatNumber(p1.y)}`,
);
```

<BindingCurved />

### 3 次ベジェ {#bezier}

点が `3n+1` 個あるときは、`[anchor, cp1, cp2, anchor, ...]` の形の 3 次ベジェ制御点として直接解釈します。そうでなければ 2 次ベジェ線分へ戻します。

```ts
if ((n - 1) % 3 === 0) {
    for (let i = 1; i + 2 < n; i += 3) {
        const cp1 = pts[i];
        const cp2 = pts[i + 1];
        const end = pts[i + 2];
        parts.push(
            `C ${formatNumber(cp1.x)} ${formatNumber(cp1.y)} ` +
                `${formatNumber(cp2.x)} ${formatNumber(cp2.y)} ` +
                `${formatNumber(end.x)} ${formatNumber(end.y)}`,
        );
    }
    return parts.join(' ');
}
```

<BindingBezier />

### 編集可能な曲線を保つ {#editable-curves}

ECS の `path` または `rough-path` が編集可能な `Q` または `C` 線分を 1 つ持つ場合、ドキュメントの読み込み時やバインディングの更新時に制御点を保持します。バインドされた端点を動かすと、隣接する 3 次の制御点も一緒に動きます。1 本の 2 次曲線が両端点を直接つなぐとき、共有制御点は両者の変位の平均だけ動きます。したがって両端を同じ量だけ動かすと、その曲線は形状を変えずに平行移動します。
バインドされていない端点は、保存された `sourcePoint` や `targetPoint` が古くなっていても、編集済みの幾何を保ちます。これらの変更を適用するとき、回転、反転、スケールが含まれます。ベジェ線分が複数あるルートは、引き続きルーターを使います。

### エッジラベル {#edge-labels}

子の `text` ノードは `edgeLabelPosition` で、親エッジ上の位置を指定できます。値は `[0, 1]` にクランプされます。`edgeLabelOffset` は法線方向の符号付き距離で、正の値は左から右へ向かう水平エッジの下にラベルを置きます。どちらのプロパティを編集してもラベルは直ちに更新され、元に戻す、やり直す、ドキュメントの再読み込みに対応します。`edgeLabelOffset` を消すとゼロに戻り、`edgeLabelPosition` を消すと自動配置を無効にします。

パスラベルは現在、コマンド端点からなるポリラインに沿って補間し、曲線の各線分には弦を使います。対応するコマンドには `H/V`、`S/T`、`A` に加え、`L`、`Q`、`C` があります。これは曲線長の近似であり、曲線の輪郭に沿った正確な配置ではありません。

## [WIP] SVG の書き出し {#export-svg}

書き出すときには、幾何情報だけを保存するのでは足りず、論理関係も永続化する必要があります。たとえば draw.io は書き出し時に、元の mxfile の内容を `<svg>` の `content` 属性へ保存します（これは正式な仕様の一部ではありません）。

```html
<svg content='&lt;mxfile host="app.diagrams.net" diagram name="Page-1"'></svg>
```

次のようにも使えます。

```html
<line x1="0" y1="0" data-binding="" />
```

## エディタ {#editor}

### アンカーの強調 {#highlight-anchors}

-   ノードが選択されたら、接続を開始できる利用可能なアンカーポイントを表示します。
-   エッジが選択されたら、ドラッグ中にドッキングできるアンカーポイントを強調します。

<BindingArrow />

[第 23 課 - マインドマップ]: /ja/guide/lesson-023
[第 25 課 - 矢印を描く]: /ja/guide/lesson-025#draw-arrow
[第 18 課 - 親子コンポーネントの定義]: /ja/guide/lesson-018#define-component
[Change the shape perimeter]: https://www.drawio.com/doc/faq/shape-perimeter-change
[JSON Canvas Spec]: https://jsoncanvas.org/spec/1.0/
[mxConnectionConstraint]: https://github.com/jgraph/drawio/blob/81a267568da862d3c99970758c09a8e768dea973/src/main/webapp/mxgraph/src/view/mxConnectionConstraint.js#L23
[OrthConnector]: https://github.com/jgraph/drawio/blob/dev/src/main/webapp/mxgraph/src/view/mxEdgeStyle.js#L1067
[simplify-js]: https://github.com/mourner/simplify-js
[第 12 課 - ポリラインの単純化]: /ja/guide/lesson-012#simplify-polyline
