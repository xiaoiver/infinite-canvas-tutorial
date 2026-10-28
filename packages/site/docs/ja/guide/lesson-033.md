---
outline: deep
description: 'Yoga 組版エンジンに対応した Flex レイアウトシステムを統合します。WebGL 環境でレイアウトエンジンを作り、レスポンシブなインターフェースデザインを実現する過程を見ていきます。'
head:
    - ['meta', { property: 'og:title', content: '第33課 - レイアウトエンジン' }]
---

<script setup>
import YogaGap from '../../components/YogaGap.vue'
import YogaFlexBasisGrowShrink from '../../components/YogaFlexBasisGrowShrink.vue'
import YogaAlignItemsJustifyContent from '../../components/YogaAlignItemsJustifyContent.vue'
import YogaButton from '../../components/YogaButton.vue'
import YogaMinMaxWidthHeight from '../../components/YogaMinMaxWidthHeight.vue'
</script>

# 第 33 課 - レイアウトエンジン {#lesson-33-layout-engine}

ブラウザは Flexbox、Grid、Block などのレイアウトシステムを実装しているため、ノードの位置を手で計算しなくても「中央揃え」のような効果を簡単に作れます。

DOM の外で動く無限キャンバスのようなアプリケーションでは、レイアウトエンジンのロジックを自分で実装する必要があります。Figma は Auto Layout を実装しています。そのうち `Grid` は現在ベータで、`Vertical` と `Horizontal` は CSS の `flex-direction` プロパティに対応します。詳しくは [Figma - Guide to auto layout] を参照してください。

![出典: https://www.figma.com/community/file/1284819663700490015](/figma-flexbox.png)

デザインからコードへつなぐツールは、通常この機能を提供します。詳しくは次を参照してください。
[Layout in pencil.dev]

> 親オブジェクトは、layout、justifyContent、alignItems のようなプロパティを通じて、Flexbox 方式のレイアウトシステムで子のサイズと位置を引き受けられます。

```ts
export interface Layout {
    /** Enable flex layout. None means all children are absolutely positioned and will not be affected by layout properties. Frames default to horizontal, groups default to none. */
    layout?: 'none' | 'vertical' | 'horizontal';
    /** The gap between children in the main axis direction. Defaults to 0. */
    gap?: NumberOrVariable;
    layoutIncludeStroke?: boolean;
    /** The Inside padding along the edge of the container */
    padding?:
        | /** The inside padding to all sides */ NumberOrVariable
        | /** The inside horizontal and vertical padding */ [
              NumberOrVariable,
              NumberOrVariable,
          ]
        | /** Top, Right, Bottom, Left padding */ [
              NumberOrVariable,
              NumberOrVariable,
              NumberOrVariable,
              NumberOrVariable,
          ];
    /** Control the justify alignment of the children along the main axis. Defaults to 'start'. */
    justifyContent?:
        | 'start'
        | 'center'
        | 'end'
        | 'space_between'
        | 'space_around';
    /** Control the alignment of children along the cross axis. Defaults to 'start'. */
    alignItems?: 'start' | 'center' | 'end';
}
```

![出典: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout/Basic_concepts](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout/Basic_concepts/basics1.svg)

この課では Flexbox レイアウトを実装し、ノード上で CSS と同じ名前のプロパティを支えます。

```ts
const parent = {
    id: 'parent',
    type: 'rect',
    x: 100,
    y: 100,
    width: 200,
    height: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};
const child = {
    id: 'child',
    parentId: 'parent',
    type: 'rect',
    width: 50,
    height: 50,
};
```

## Yoga {#yoga}

フロントエンドで [Yoga] レイアウトエンジンを使うには、WASM を経由する必要があります。現在、使える実装はいくつかあります。

-   [yoga-layout-prebuilt] 最後の更新から長い時間が経っています。
-   [yoga-wasm-web] 初期の [satori] は、HTML を SVG に変換してレイアウトを計算するために使っていました。[taffy] にも関連する [例](https://github.com/DioxusLabs/taffy/pull/394#issuecomment-1476430705) があります。
-   [yoga-layout] これを使うことを勧めます。私たちの実装もこれに基づいています。[react-pdf/yoga] もこれを使っています。

Yoga は、平面を指定すれば 3D 空間にも適用できます。詳しくは [react-three-flex] を参照してください。

> DOM の Flexbox とのもう一つの重要な違いは、3D でコンテナの平面を指定する必要があることです。要素は 2 つの軸が定める 2D 平面上に配置され、その 2 軸に沿って計算した width と height を使います。

![軸の向き](https://github.com/pmndrs/react-three-flex/raw/master/docs/axes_orientation.png)

### pixijs/layout {#pixijs-layout}

[pixijs/layout] も Yoga で実装されています。似た実装には [pixi-flex-layout] があります。

```ts
const container = new Container({
    layout: {
        width: '80%',
        height: '80%',
        gap: 4,
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignContent: 'center',
    },
});
```

### troika-flex-layout {#troika-flex-layout}

[troika-flex-layout] は、[yoga-layout-prebuilt] を使って Web Worker で計算します。

```ts
import { requestFlexLayout } from 'troika-flex-layout';

// Describe your layout style tree, with a unique id for each node:
const styleTree = {
    id: 'root',
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    children: [
        {
            id: 'child',
            width: '50%',
            height: '50%',
        },
    ],
};

// Initiate a layout request with a callback function:
requestFlexLayout(styleTree, (results) => {
    // The results are a mapping of node ids to layout boxes:
    // {
    //   root: { left: 0, top: 0, width: 100, height: 100 },
    //   child: { left: 25, top: 25, width: 50, height: 50 }
    // }
});
```

## Yoga 以外の選択肢 {#alternatives-to-yoga}

純粋な JS 実装:

-   [Motion Canvas Layouts] ブラウザネイティブの Flexbox 実装を使い、複雑なレイアウトアルゴリズムを再実装せずに済みます。
-   [Simplifying WebGL: Building an Effective Layout Engine]

Rust 実装:

-   [stretch] は Flexbox を実装し、`stretch-layout` の WASM バインディングを提供しますが、長いあいだ保守されていません。
-   [taffy] Rust で書かれた高性能な UI レイアウトライブラリです。現在、Flexbox、Grid、Block を含むいくつかの CSS レイアウトアルゴリズムを実装しています。ただし WASM バインディングはまだありません。詳しくは [taffy wasm bindings] を参照してください。

## 私たちの実装 {#our-implementation}

公式の [yoga-layout] を選びました。よく知る Flexbox に加え、Margin や Padding のような基本的なレイアウトプロパティも提供します。

```ts
import { loadYoga } from 'yoga-layout/load';

class YogaSystem extends System {
    async prepare() {
        Yoga = await loadYoga();
    }
}
```

シーングラフと並行するレイアウト木を構築する必要があります。

まず、シーングラフと並行するレイアウト木を作ります。ノードの構造は次のとおりです。

```ts
interface StyleTreeNode {
    id: string;
    top?: number | string;
    left?: number | string;
    width?: number | string;
    height?: number | string;
    children: StyleTreeNode[];
    padding?: number | number[];
    margin?: number | number[];
    gap?: number;
    rowGap?: number;
    columnGap?: number;
}
```

その後、適切なタイミングでレイアウト木を Yoga の木に変換し、レイアウト計算を実行して、結果をシーングラフのノードへ適用します。

```ts
const root = Yoga.Node.createWithConfig(yogaConfig);
populateNode(root, styleTree);

root.calculateLayout();
const results = Object.create(null);
walkStyleTree(styleTree, (styleNode) => {
    const { id, yogaNode } = styleNode;
    results[id] = {
        x: yogaNode.getComputedLeft(),
        y: yogaNode.getComputedTop(),
        width: yogaNode.getComputedWidth(),
        height: yogaNode.getComputedHeight(),
    };
});
root.freeRecursive();
```

### レイアウトを行うタイミング {#when-to-do-layout}

Flexbox コンテナ自身のサイズが変わったときは、レイアウトを再計算し、その結果を子の位置とサイズに適用する必要があります。コンテナに新しい子が追加されたときも同様です。

```ts
class YogaSystem extends System {
    private readonly bounds = this.query((q) =>
        q.addedOrChanged.and.removed
            .with(ComputedBounds)
            .trackWrites.and.with(Flex),
    );

    execute() {
        this.bounds.addedOrChanged.forEach((entity) => {
            // relayout
        });
    }
}
```

### AlignItems と JustifyContent {#align-items-justify-content}

最もよくある使い方は、この 2 つのプロパティで内容を中央に揃えることです。

<YogaAlignItemsJustifyContent />

テキストを中央に置いたボタンを実装します。

ラベルは内在幅（`wordWrap: false`）を使い、Yoga が計測したテキストボックスをボタン内で中央に置きます。固定の `wordWrapWidth` に `maxLines: 1` と `textOverflow: 'ellipsis'` を組み合わせると、ボタンに余裕があってもラベルが切り詰められることがあります。意図して切り詰めるラベルにだけ、これらのオプションを残してください。

<YogaButton />

### 間隔 {#gap}

次の例は、`padding` と `gap` の効果を示します。

```ts
const parent = {
    id: 'yoga-gap-parent',
    type: 'rect',
    x: 100,
    y: 100,
    width: 200,
    height: 250,
    fill: 'grey',
    display: 'flex',
    padding: 10,
    flexWrap: 'wrap',
    gap: 10,
    zIndex: 0,
};
```

<YogaGap />

### Flex Basis、Grow、Shrink {#flex-basis-grow-shrink}

[Flex Basis, Grow, and Shrink]

> Flex grow は 0 以上の任意の浮動小数点値を受け取り、既定値は 0 です。コンテナは余った空間を、子の flex grow 値を重みとして子に分配します。

<YogaFlexBasisGrowShrink />

### 最小／最大の幅と高さ {#min-max-width-height}

[Min/Max Width and Height]

<YogaMinMaxWidthHeight />

## SVG への書き出し {#export-svg}

CSS Flexbox はコンテナとして HTML 要素だけを支え、SVG 要素は支えないため、SVG へ書き出すときはレイアウト後の絶対位置をそのまま使う必要があります。

```ts
const layoutNodes = api.readLayoutFromECS(nodes);

(await serializeNodesToSVGElements(layoutNodes)).forEach((element) => {
    $namespace.appendChild(element);
});
```

## さらに読む {#extended-reading}

-   [Simplifying WebGL: Building an Effective Layout Engine]
-   [clay]
-   [react-three-flex]
-   [Figma - Guide to auto layout]
-   [Layout in rive]

[Yoga]: https://yogalayout.com/
[yoga-layout-prebuilt]: https://github.com/vadimdemedes/yoga-layout-prebuilt
[yoga-wasm-web]: https://github.com/shuding/yoga-wasm-web
[yoga-layout]: https://www.yogalayout.dev/
[taffy]: https://github.com/DioxusLabs/taffy
[Simplifying WebGL: Building an Effective Layout Engine]: https://blog.certa.dev/building-a-layout-engine-for-webgl
[troika-flex-layout]: https://github.com/protectwise/troika/blob/main/packages/troika-flex-layout/
[clay]: https://github.com/nicbarker/clay
[Motion Canvas Layouts]: https://motioncanvas.io/docs/layouts
[pixijs/layout]: https://github.com/pixijs/layout
[pixi-flex-layout]: https://github.com/fireveined/pixi-flex-layout/
[react-three-flex]: https://github.com/pmndrs/react-three-flex/
[satori]: https://github.com/vercel/satori
[stretch]: https://github.com/vislyhq/stretch
[taffy wasm bindings]: https://github.com/DioxusLabs/taffy/pull/394
[Figma - Guide to auto layout]: https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout
[react-pdf/yoga]: https://github.com/diegomura/react-pdf/blob/master/packages/layout/src/yoga/index.ts
[Flex Basis, Grow, and Shrink]: https://www.yogalayout.dev/docs/styling/flex-basis-grow-shrink
[Min/Max Width and Height]: https://www.yogalayout.dev/docs/styling/min-max-width-height
[Layout in pencil.dev]: https://docs.pencil.dev/for-developers/the-pen-format#layout
[Layout in rive]: https://rive.app/docs/editor/layouts/layouts-overview
