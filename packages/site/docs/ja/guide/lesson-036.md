---
outline: deep
description: 'アニメーションシステムを実装します。宣言的なアニメーション API の設計、Web Animations API との互換、ジェネレーター関数に基づくアニメーションの流れ、SVG パスのアニメーション技法を扱います。'
head:
    - ['meta', { property: 'og:title', content: '第36課 - アニメーション' }]
---

<script setup>
import AnimationController from '../../components/AnimationController.vue';
import AnimationEasing from '../../components/AnimationEasing.vue';
import AnimationTransformOrigin from '../../components/AnimationTransformOrigin.vue';
import AnimationDasharray from '../../components/AnimationDasharray.vue';
import AnimationDashoffset from '../../components/AnimationDashoffset.vue';
import AnimationMorphing from '../../components/AnimationMorphing.vue';
import AnimationLottieBouncyBall from '../../components/AnimationLottieBouncyBall.vue';
import AnimationLottiePolyStar from '../../components/AnimationLottiePolyStar.vue';
import AnimationLottieRepeater from '../../components/AnimationLottieRepeater.vue';
import AnimationTimeline from '../../components/AnimationTimeline.vue';
</script>

# 第 36 課 - アニメーション {#lesson-36-animation}

この課では、次の内容を学びます。

-   アニメーション API の設計方法
-   Web Animations API に沿った、宣言的なキーフレームとコントローラーの実装方法
-   パス、ストローク、モーフィング効果の実装方法
-   Lottie のような形式が、この構成のどこに入るか

## アニメーション API の設計方法 {#api-design}

Motion は、宣言的な WAAPI スタイルのアニメーションと完全に互換です。[Improvements to Web Animations API] を参照してください。GPU アクセラレーション、独立したコンポジタースレッド、メインスレッドの外での処理のために、ブラウザネイティブの `element.animate()` を呼び出します。JavaScript は、WAAPI が提供しない機能を補います。

-   スプリング物理（WAAPI がサポートするのはベジェのイージングだけです）
-   独立した `transform` プロパティ（一つにまとめた transform 文字列ではなく、`x`、`y`、`scale` を別々にアニメーションします）
-   スケールと回転の中心のための `transformOrigin`
-   `sequence()` や `stagger()` のようなタイムラインのヘルパー

```ts
import { animate, stagger } from 'motion';

// Returns a controller you can pause, play, and reverse
const controls = animate(
    '.box',
    { x: [0, 100], opacity: [0, 1] }, // keyframes
    { duration: 0.5, delay: stagger(0.1), easing: 'spring(1, 100, 10, 0)' },
);

// Serializable control calls
controls.pause();
controls.play();
controls.reverse();
```

キーフレームとオプションはプレーンなオブジェクトで、JSON にシリアライズできます。`animate()` のランタイム状態、つまり DOM へのバインディング、現在時刻、速度などはシリアライズできません。

## WAAPI に従う {#waapi}

WAAPI のポリフィル [web-animations-js] に従い、こちらの ECS と統合できます。

**データ層:** WAAPI に似たキーフレーム（シリアライズ可能）

```ts
interface Keyframe {
    offset?: number; // 0–1, same role as WAAPI offset
    [property: string]: any; // x, y, scale, fill, strokeWidth...
    easing?: string; // "ease-out", "spring(1, 100)"
}

interface AnimationOptions {
    duration: number; // ms
    delay?: number;
    iterations?: number | 'infinite';
    direction?: 'normal' | 'reverse' | 'alternate';
    fill?: 'forwards' | 'backwards' | 'both'; // How the animation appears when not running (before start, after end).
    easing?: string; // Global easing if a keyframe omits its own
}
```

**制御層:** WAAPI に似た `Animation` コントローラー。完全な WAAPI ポリフィルとの違いは次のとおりです。

-   CSS 文字列は解析しません。WAAPI は `{ transform: 'translate(100px)' }` を許せますが、解析コストが高くなります。`{ x: 100 }` のように、Motion スタイルの独立した transform プロパティを優先します。
-   組み込みの `ease`、`ease-in`、`ease-out`、`linear` に加え、Motion スタイルの `spring(mass, stiffness, damping)` もあります。
-   **Composite** モード。WAAPI の `composite: 'add' | 'replace'` のように、アニメーションを基準値の上に重ねます（例: エンティティの位置に、アニメーションするオフセットを加えます）。
-   **Timeline** のサポート。Motion の `timeline()` や WAAPI の `GroupEffect` のように、エンティティ間の stagger を含みます。

### コントローラー {#controller}

```ts
const animation = api.animate(
    node1,
    [
        { x: 100, fill: 'green' },
        { x: 200, fill: 'red' },
    ],
    {
        duration: 1000,
        direction: 'alternate',
        iterations: 'infinite',
        easing: 'ease-in-out',
    },
);
animation.pause();
animation.play();
animation.finish();
```

<AnimationController />

### 補間 {#interpolation}

`x` / `y` / `opacity` のようなスカラーは、そのまま補間できます。`fill` / `stroke` は `d3-color` のようなもので色を解析し、rgba の各チャンネルを補間します。

線形グラデーションでは、ストップの数が一致するとき、各ストップの位置と色を補間します。数が異なるときは、両方のグラデーションのストップ位置を合わせ、色が急に切り替わることを表す重複した位置は残します。これにより、両方のキーフレームが同じグラデーションを含むとき、不均一な間隔が保たれます。

ECS では、`fill` / `fillOpacity` と `stroke` / `strokeOpacity` が、最初に有効なペイントレイヤーをまとめて更新します。他のレイヤーとその有効状態は保たれます。有効なレイヤーがなければ、ペイントをアニメーションするとレイヤーが 1 つ追加されます。不透明度だけをアニメーションしても、新しいレイヤーは作られません。

```ts
function interpolateValue(from: unknown, to: unknown, t: number) {
    if (isFiniteNumber(from) && isFiniteNumber(to)) {
        return interpolateNumber(from, to, t);
    }
    const fromColor = parseColor(from);
    const toColor = parseColor(to);
    if (fromColor && toColor) {
        return colorToRgbaString({
            r: interpolateNumber(fromColor.r, toColor.r, t),
            g: interpolateNumber(fromColor.g, toColor.g, t),
            b: interpolateNumber(fromColor.b, toColor.b, t),
            a: interpolateNumber(fromColor.a, toColor.a, t),
        });
    }
    return t < 1 ? from : to;
}
```

### イージング {#easing-function}

標準のカーブに加えて、`spring` もサポートできます。

```ts
function evaluateEasing(easing: string, t: number) {
    const p = clamp01(t);
    const bezier = EASING_FUNCTION[easing as keyof typeof EASING_FUNCTION];
    if (bezier) {
        return clamp01(bezier(p));
    }
    if (easing.startsWith('spring(')) {
        return evaluateSpringEasing(p, easing);
    }
    return p;
}
```

<AnimationEasing />

### 変換の原点 {#transform-origin}

<AnimationTransformOrigin />

## 特殊なアニメーション効果 {#special-effects}

### パスアニメーション {#path-animation}

グラフィックをパスに沿って動かすことはよくあります。CSS では Motion Path で行います。

```css
#motion-demo {
    animation: move 3000ms infinite alternate ease-in-out;
    offset-path: path('M20,20 C20,100 200,0 200,100');
}
@keyframes move {
    0% {
        offset-distance: 0%;
    }
    100% {
        offset-distance: 100%;
    }
}
```

### ストロークアニメーション {#stroke-animation}

パスの長さが必要です。

```ts
const length = api.getTotalLength(path);
api.animate(
    path,
    [{ strokeDasharray: [0, length] }, { strokeDasharray: [length, 0] }],
    {
        duration: 3500,
    },
);
```

<AnimationDasharray />

### ダッシュオフセット {#dashline-offset}

draw.io は、アニメーションでコネクタの方向を示します。

![出典: https://www.drawio.com/doc/faq/connector-animate](https://www.drawio.com/assets/img/blog/connector-flow-animation.svg)

> ダイアグラムを SVG ファイルに書き出すと、SVG 画像に対応したウェブページやコンテンツプラットフォームで公開するときに、コネクタのアニメーションを含められます。

```ts
api.animate(node, [{ strokeDashoffset: -20 }, { strokeDashoffset: 0 }], {
    duration: 500,
    iterations: Infinity,
});
```

<AnimationDashoffset />

### モーフィング {#morphing}

多くの SVG ライブラリがモーフィングを示しています。

-   [Paper.js]
-   [Kute.js] は Morph と CubicMorph を提供します
-   GreenSock の MorphSVGPlugin は Canvas でもレンダリングできます
-   [vectalign]

一部のライブラリは、モーフィングの前後でセグメント構造が一致していることを要求します。一致しないと、補間は失敗します。

Kute.js の CubicMorph に従います。パスのセグメントを 3 次ベジェに変換し、3 次ベジェは分割しやすいという性質を使って両方のパスを同じセグメント数にそろえ、セグメントごとに制御点を補間します。

ワインディングと始点の整列は、両方のパスが閉じた輪郭を 1 つだけ含むときに限り適用されます。開いたパスは端点の順序を保つので、曲線を平行移動しても端点が入れ替わったり、アニメーションの途中で曲線が潰れたりしません。

```ts
function mergePaths(
    left: { absolutePath: AbsoluteArray; curve: CurveArray | null },
    right: { absolutePath: AbsoluteArray; curve: CurveArray | null },
): [CurveArray, CurveArray, (b: CurveArray) => CurveArray] {
    let curve1 = left.curve;
    let curve2 = right.curve;
    if (!curve1 || curve1.length === 0) {
        // convert to curves to do morphing & picking later
        // @see http://thednp.github.io/kute.js/svgCubicMorph.html
        curve1 = path2Curve(left.absolutePath, false) as CurveArray;
        left.curve = curve1;
    }
    if (!curve2 || curve2.length === 0) {
        curve2 = path2Curve(right.absolutePath, false) as CurveArray;
        right.curve = curve2;
    }

    let curves = [curve1, curve2];
    if (curve1.length !== curve2.length) {
        curves = equalizeSegments(curve1, curve2);
    }

    const closed = [left.absolutePath, right.absolutePath].every(
        (path) =>
            path[path.length - 1]?.[0] === 'Z' &&
            path.filter(([command]) => command === 'M').length === 1,
    );
    const curve0 =
        closed && getDrawDirection(curves[0]) !== getDrawDirection(curves[1])
            ? reverseCurve(curves[0])
            : (clonePath(curves[0]) as CurveArray);

    return [
        curve0,
        closed ? (getRotatedCurve(curves[1], curve0) as CurveArray) : curves[1],
        (pathArray: CurveArray) => pathArray,
    ];
}
```

<AnimationMorphing />

## Lottie {#lottie}

-   [lottie json schema]
-   [Tips for rendering]
-   [lottie-parser] — 主にその解析ロジックに従います
-   [velato] — Vello の上に構築されたレンダラーです

### 使い方 {#lottie-usage}

Lottie JSON をグラフィックとキーフレームへ変換するプラグインを実装しました。要点は次のとおりです。

-   Shape レイヤーの次の要素をサポートします。
    -   [Rectangle](https://lottiefiles.github.io/lottie-docs/shapes/#rectangle)
    -   [Ellipse](https://lottiefiles.github.io/lottie-docs/shapes/#ellipse)
    -   [PolyStar](https://lottiefiles.github.io/lottie-docs/shapes/#polystar)
    -   [Path](https://lottiefiles.github.io/lottie-docs/shapes/#path)
    -   [Group](https://lottiefiles.github.io/lottie-docs/shapes/#group)
-   Lottie では、`anchorX` / `anchorY` が図形のバウンディングボックス左上を基準に、スケールと回転の中心を定義します。`transformOrigin` へ対応付けるときは注意してください
-   複数のアニメーショントラックを 1 つのキーフレーム集合にまとめ、欠けているプロパティを補います

```ts
import { loadAnimation } from '@infinite-canvas-tutorial/lottie';

const response = await fetch('/bouncy_ball.json');
const animation = loadAnimation(await response.json(), {
    loop: true,
    autoplay: true,
    onDiagnostic: ({ code, path, message }) =>
        console.info(code, path, message),
});

await api.edit(() => animation.render(api), { capture: 'NEVER' });

// On component unmount (also automatically cleaned up on canvas destruction):
// await animation.destroy();
```

以下は、こちらの環境で実行した公式サンプルです。[Bouncy Ball]

<AnimationLottieBouncyBall />

### 互換性 {#lottie-compatibility}

このインポーターは Lottie を ECS ノードとキーフレームに変換します。完全な Lottie レンダラーではありません。フィールドを解析しても、その視覚効果を実装したことにはなりません。

| 機能                                                | 現在の動作                                                                                                                                                                                                                                               |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 矩形、楕円、パス、グループ。基本の塗り/ストローク   | 基本的な静的ジオメトリ、パスのモーフィング、2D の位置/回転/スケール。プリミティブのサイズ/コーナーのアニメーションは、依然として限定的です                                                                                                               |
| PolyStar                                            | 星/多角形、両方のワインディング、頂点数、位置、回転、内側/外側の半径と丸み。時間イージングとホールド付きの数値キーフレーム                                                                                                                               |
| Repeater                                            | 先行する図形/グループのコピー。個数、オフセット、アンカー、移動、スケール、回転、開始/終了の不透明度、合成順序。数値キーフレームを含む                                                                                                                   |
| Solid、Null、親子関係、Precomp                      | 基本的なサポート。レイヤーの in/out 可視性、タイムストレッチ、リマップは未完成です                                                                                                                                                                       |
| グラデーションと複数ペイント                        | 基本的なグラデーション。アニメーションするグラデーションのジオメトリ、放射状ハイライト、複数のペイント/オペレーターの順序は、依然として限定的です                                                                                                        |
| Trim Paths                                          | ストロークダッシュで近似し、完全/空のカバレッジ、端点の並べ替え、オフセットを補正しています。塗りのジオメトリ、マルチパスモード、既存のダッシュパターン、アニメーションする長さ 0 のラウンドキャップ、方向、モディファイアの順序は、依然として限定的です |
| 空間ベジェモーション、Skew                          | 未完成です。検査のときに報告されます                                                                                                                                                                                                                     |
| Merge Paths、Round Corners とその他のモディファイア | レンダリングされません                                                                                                                                                                                                                                   |
| Image                                               | 部分対応です。アセットディレクトリとプリロードは実装されていません                                                                                                                                                                                       |
| Text、Masks、Track Mattes、Effects、Blend Modes、3D | 未実装か、安定してレンダリングされません。ECS がその機能を備えていても、Lottie のインポート対応を意味しません                                                                                                                                            |
| Expressions                                         | インポート時にベイクします。既定は、限定的な shape レイヤー環境を持つ同梱の lottie-web ExpressionManager であり、AE のセマンティクス全体ではありません                                                                                                   |

`inspectLottie(data)` は、JSON を変更せず、エクスプレッションも評価せずに、既知の不足を検査します。`animation.getDiagnostics()` と `onDiagnostic` は、安定した `code`、`severity`（`partial` / `unsupported`）、JSON Pointer の `path`、メッセージを提供します。診断があってもインポートは続きます。リストが空でも、AE との互換を保証するものではありません。例の **Compatibility notes** を展開すると、その不足を確認できます。

再生にはコンポジションクロックを 1 つ使います。`goTo(value, true)` は、コンポジション相対のフレームへシークします。既定の単位は秒で、再生/一時停止の状態は保たれます。`stop()` はフレーム 0 で一時停止します。`setSpeed()` は正の倍率を受け取ります。`setDirection(-1)` は速度を保ったまま、現在位置から逆再生します。`playSegments([start, end])` は両方の端点に従います。端点が降順なら逆再生します。数値の `loop` は、追加で繰り返す回数です。`getAnimations()` が返す ECS コントローラーは、プレイヤーがサンプリングします。時間はプレイヤー API で制御してください。

同じインスタンスで `render(api)` を繰り返しても冪等です。別のキャンバスには別のインスタンスが必要です。`destroy()` も冪等で、再生を取り消し、安全な編集の中でインポートしたノードツリーを取り除きます。コンポーネントは、アンマウント時に未完了の fetch と、キューに入った編集も取り消す必要があります。ブラウザのリグレッションテストは、固定したフレームを、バージョンをピン留めした lottie-web と比較します。対象は、位置、単一パスのストローク Trim Paths、整数フレームと小数フレームでの PolyStar のジオメトリと Repeater グループです。これらは、フォーマット全体の同等性を示すものではありません。

### 星と多角形 {#lottie-polystar}

PolyStar（`ty: "sr"`）は、閉じたベジェパスを生成します。`sy: 1` は星、`sy: 2` は多角形です。頂点数（`pt`）、位置（`p`）、回転（`r`）、半径（`or` / `ir`）、丸み（`os` / `is`）は、それぞれ独立してアニメーションできます。内側のプロパティは星にだけ適用されます。`d: 3` はワインディングを反転します。小数の頂点数は切り捨てられ、これは lottie-web 5.13 と同じです。頂点数のあいだを連続してモーフィングするわけではありません。

この例は、両方の図形をアニメーションします。一時停止、逆再生、または **Seek frame** のドラッグで、途中のジオメトリを確認できます。パラメータはパスを作る前に補間されるので、回転しても半径は保たれ、頂点数の変化は正しい瞬間に反映されます。

<AnimationLottiePolyStar />

アニメーションする PolyStar のジオメトリは、コンポジションクロック上のプラグインコントローラーがサンプリングします。再読み込みできるよう、元の Lottie JSON を残してください。プレーンな ECS キーフレームのシリアライズとアニメーションエディターは、これらの手続き的なパラメータトラックを、まだ保持も編集もしません。位置の空間タンジェント、モディファイアの組み合わせ（変化するジオメトリ上の Trim Paths を含む）、エクスプレッション、および表にあるその他の制限は、引き続き適用されます。曲線ストロークは、テッセレーションされた一部の接合で、ECS レンダラーがもともと持つ透明度の継ぎ目も引き継ぎます。その参照テストが確かめるのはシルエットと色であり、アルファの一致ではありません。

### Lottie のベジェ曲線 {#beziers-in-lottie}

[Beziers in Lottie]

-   `v` は頂点の配列です。
-   `i` は `v` に相対的な “in” タンジェント点の配列です。
-   `o` は `v` に相対的な “out” タンジェント点の配列です。
-   `c` は、ポリベジェが閉じているかを決める真偽値です。閉じている場合、`v` の最後の点と最初の点のあいだに、ベジェセグメントがもう 1 つあります。

### Repeater {#repeater}

Repeater（`ty: "rp"`）は、現在のシェープグループの中で、自分より前にあるオペレーターを複製します。各コピーを独立して塗るには、塗り/ストロークを **繰り返されるグループの内側** に置いてください。ネストしたシェープグループと、アニメーションする PolyStar のジオメトリも繰り返せます。ネストした、または積み重ねた Repeater は、現在は再帰的に複製し、`shape.repeater.nested` を出します。複合の順序と、残される元のコピーは、lottie-web と異なることがあります。

コピー数（`c`）は切り上げます。0 はすべてのコピーを隠します。オフセット（`o`）は小数と負の値を受け付けます。変換（`tr`）には、アンカー（`a`）、移動（`p`）、非均一スケール（`s`）、回転（`r`）、開始/終了の不透明度（`so` / `eo`）が含まれます。合成モード（`m`）は、コピーの重なり順を変えます。数値トラックは時間イージングとホールドをサポートします。変換は lottie-web 5.13 に従い、負の整数オフセットで恒等変換を横切る挙動も含みます。

<AnimationLottieRepeater />

インポーターは、イージングのオーバーシュートを含め、個数トラックの上限からコピーのプールを確保します。再生とシークはこのプールを再利用します。大きな個数とネストした repeater は、インポートされるノード数を掛け合わせます。PolyStar と同じく、元の Lottie JSON を残してください。プレーンな ECS キーフレームのシリアライズとアニメーションエディターは、これらの手続き的トラックを保持しません。

Repeater の **後** にあるペイントオペレーターは部分的なサポートで、`shape.repeater.paint-scope` を出します。コピーごとのペイント継承では、lottie-web の共有された複合塗りが作るカバレッジと不透明度は再現されません。モディファイアの順序、skew、空間モーション、レイヤーのタイミングは、引き続き互換性の表に従います。逆変換できない特異なスケール（例: スケール 0 と負のオフセット）は、無効な変換を送る代わりに、影響するコピーを隠します。

### エクスプレッション {#expression}

[Expressions]

```json
{
    "ty": "sh",
    "ks": {
        "a": 0,
        "k": {
            "i": [],
            "o": [],
            "v": []
        },
        "x": "var group = thisLayer.content(\"Quadratic Points\");\nvar num_points = 3;\nvar points = [];\nvar ip = [];\nvar op = [];\nfor ( var i = 0; i < num_points; i++ )\n{\n    var pos = group.content(\"p\" + i).position;\n    points.push(pos);\n    ip.push(pos);\n    op.push(pos);\n}\nvar $bm_rt = {\n    v: points,\n    i: ip,\n    o: op\n};\n"
    }
}
```

### テキストレイヤー {#text-layer}

テキストレイヤーとテキストアニメーターは、まだインポートされません。

### クリッピングマスク {#clipping-mask}

マスクモード、反転、アニメーション、Track Matte は、安定してレンダリングされません。

[clipping-masks]

### レイヤーエフェクト {#layer-effects}

Lottie エフェクトは、まだ ECS に対応付けられていません。

[Layer Effects]

## Rive {#rive}

[Rive vs Lottie]

![出典: https://rive.app/blog/rive-as-a-lottie-alternative](https://framerusercontent.com/images/gKzhMgEDMMUPLVkhMtTDfQdQrQ.png?width=1920&height=800)

## Manim {#manim}

<https://github.com/3b1b/manim>

-   [Discussion in HN]

## アニメーションエディター {#animation-editor}

[lottielab] や [Jitter] のような製品に着想を得て、Web Components 層に軽量なアニメーションエディターを作りました。右側の **アニメーションパネル** は選択中の要素のキーフレームを編集し、下部の **タイムラインパネル** はシーン全体のタイムラインを表示して、そのキャンバスのプレイヘッドを動かします。両者は、同じシリアライズ可能なキーフレームデータと、`AppState` のシーンクロックを共有します。

![出典: https://jitter.video/](/jitter.png)

### レイアウト {#animation-editor-layout}

タスクバーには、互いに独立したトグルが 2 つあります。

-   `SHOW_ANIMATION_PANEL` → `ic-spectrum-animation-panel`（右側、プロパティパネルの隣）
-   `SHOW_TIMELINE_PANEL` → `ic-spectrum-timeline-panel`（下部のドック、キャンバスの全幅）

典型的な作業の流れ:

1. 要素を 1 つ選び、アニメーションパネルでアニメーションを追加するか、プロパティトラックを編集します。
2. タイムラインを開き、シーン内でアニメーションするすべてのレイヤーとその時間範囲を見ます。
3. プレイヘッドをスクラブするか再生を押し、ある一瞬のシーン全体をプレビューします。
4. タイムラインでトラックを選ぶと、その要素も選択されます。右のアニメーションパネルが、その要素のキーフレームを表示します。

### シーンクロックと編集モード {#animation-scene-clock}

タイムラインが動かすのは、各 `AnimationController` から切り離された **`AppState` 内のキャンバスのプレイヘッド** です。ECS ワールドを共有するキャンバスは、プレイヘッド、再生状態、シーンの長さをそれぞれ独立して持ちます。

| フィールド             | 意味                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `animationEditing`     | `true` のとき、**決定的なスクラブモード** に入ります。このキャンバスのすべてのコントローラーは、それぞれ自由に進まず、同じ `animationCurrentTime` でサンプリングされます |
| `animationCurrentTime` | このキャンバスのプレイヘッド位置（ミリ秒）                                                                                                                               |
| `animationPlaying`     | プレイヘッドが自動で進むかどうか                                                                                                                                         |
| `animationLoop`        | 再生がシーンの終わりで 0 に戻るかどうか                                                                                                                                  |

`animationEditing === true` のとき、`AnimationSystem` はそのキャンバスに属するエンティティだけをサンプリングします。一時停止中、コントローラーは `animationCurrentTime` に固定されます。再生中、プレイヘッドは `performance.now()` のデルタで進みます。再生を再開するとき、一時停止中に経過した実時間は含めません。シーンの長さは、そのキャンバスのトラックで決まります。

編集モードを離れると、エディターが一時停止したコントローラーは、現在位置から自動再生を再開します。呼び出し側がすでに一時停止していたコントローラーは一時停止のまま残り、キャンセルされたコントローラーは再起動されません。

タイムラインを開くと、スクラブとプレビューがずれないよう、自動的に `setAnimationEditing(true)` が呼ばれます。

### タイムラインパネルの設計 {#animation-timeline}

<AnimationTimeline />

#### トラックデータ {#track-data}

タイムラインはノード JSON を直接読まず、`api.getAnimatedTracks()` で集約します。

```ts
interface Track {
    id: string; // node id
    name: string; // layer name; falls back to id
    properties: string[]; // e.g. ['opacity', 'x']
    delay: number; // ms
    duration: number; // active animation length (total − delay)
    totalDuration: number;
}
```

シーンの長さ = 全トラックの `totalDuration` の最大値。バーの `left` / `width` は、`delay * PX_PER_MS` と `duration * PX_PER_MS` で計算します。

#### インタラクション {#interactions}

| 操作                        | 挙動                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------- |
| トラックラベルをクリック    | `layersSelected = [track.id]` とし、トラックを強調してアニメーションパネルを駆動します |
| レーン / ルーラーをドラッグ | プレイヘッドをスクラブします。キャンバスがそのフレームをライブでプレビューします       |
| 再生 / 一時停止             | `toggleAnimationPlaying()` が、編集モードでシーン全体のクロックを進めます              |
| ループ                      | `setAnimationLoop()` が、シーンが終わりで先頭へ戻るかを制御します                      |

### アニメーションパネル（タイムラインと連携） {#animation-panel}

コンポーネント: `packages/webcomponents/src/spectrum/animation-panel.ts`。

-   **1 つだけ** 選択しているときのみ編集できます。複数選択、または未選択ではプレースホルダーを表示します。
-   グローバルオプション: `duration`、`delay`、既定の `easing`、`iterations`（ループスイッチ）。
-   キーフレームは **プロパティトラック** ごとにまとまります。各行には `offset`（0–1）、値、`easing`、削除ボタンがあります。
-   **Add keyframe at playhead**: `animationCurrentTime` を読み、正規化したオフセットに変換し、`controller.getCurrentValues()` で現在のプロパティ値をサンプリングします。キーフレームを挿入する前に、タイムラインを開いて目標の時刻までスクラブしてください。
-   `fill` / `stroke` はポップオーバーと `ic-spectrum-color-picker` を使います。その他の数値プロパティは `sp-number-field` を使います。
-   パネルの幅と高さは変更できます。サイズは `localStorage` に残ります（プロパティパネルと同じハンドル操作です）。

すべての編集は `setNodeAnimation` / `updateNodeAnimationKeyframe` を通り、アンドゥ履歴とドキュメントのシリアライズに参加します。

### Lottie スタイルのエディターとの違い {#animation-editor-vs-lottie}

現在の実装は、[lottielab] のような本格的な DCC ツールと比べ、意図的に単純なままです。

-   タイムラインは、Lottie のレイヤー + プロパティという複数トラックの配置ではなく、**ノードごとに 1 トラック** を使います。プロパティ名はラベルの接尾辞として表示されます（`Rect · opacity, x`）。
-   キーフレームとバーのタイミングは、まだタイムライン上でドラッグできません。タイミングはアニメーションパネルの `offset` で編集します。
-   エクスプレッションは、限定的なインポート時のベイクを使います。テキストレイヤーとクリッピングマスクは、このエディターでは安定してサポートされず、ここで作成することもできません。

考えられる拡張として、プロパティのサブトラック、キーフレームのダイヤモンドマーカー、バーの端をドラッグして delay/duration を変える機能などがあります。

### 外部参照 {#external-references}

-   [lottielab]
-   [omnilottie]
-   [thorvg.viewer]
-   [Jitter]

## さらに読む {#further-reading}

-   [Magic Animator]
-   [A major breakthrough in real-time vector graphics]
-   [Art meets technology: the next step in bringing our characters to life]
-   [Canvas vs WebGL]

[Improvements to Web Animations API]: https://motion.dev/docs/improvements-to-the-web-animations-api-dx
[A major breakthrough in real-time vector graphics]: https://rive.app/renderer
[Art meets technology: the next step in bringing our characters to life]: https://blog.duolingo.com/world-character-visemes/
[Canvas vs WebGL]: https://rive.app/community/doc/canvas-vs-webgl/docanjXoQ1uT
[vectalign]: https://github.com/bonnyfone/vectalign
[Magic Animator]: https://magicanimator.com/
[Discussion in HN]: https://news.ycombinator.com/item?id=44994071
[lottielab]: https://www.lottielab.com/
[Jitter]: https://jitter.video/
[omnilottie]: https://fal.ai/models/fal-ai/omnilottie/api
[web-animations-js]: https://github.com/web-animations/web-animations-js
[lottie json schema]: https://lottiefiles.github.io/lottie-docs/schema/
[Paper.js]: http://paperjs.org/
[Kute.js]: https://thednp.github.io/kute.js/
[Tips for rendering]: https://lottiefiles.github.io/lottie-docs/rendering/
[lottie-parser]: https://github.com/pissang/lottie-parser
[velato]: https://github.com/linebender/velato
[Bouncy Ball]: https://lottiefiles.github.io/lottie-docs/breakdown/bouncy_ball/
[Beziers in Lottie]: https://lottiefiles.github.io/lottie-docs/breakdown/bezier/#beziers-in-lottie
[Expressions]: https://lottiefiles.github.io/lottie-docs/expressions/
[clipping-masks]: https://lottie-animation-community.github.io/docs/specs/layers/common/#clipping-masks
[Layer Effects]: https://lottiefiles.github.io/lottie-docs/effects/#layer-effects
[thorvg.viewer]: https://github.com/thorvg/thorvg.viewer
[Rive vs Lottie]: https://rive.app/blog/rive-as-a-lottie-alternative
