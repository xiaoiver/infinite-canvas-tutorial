---
outline: deep
description: 'Pencil のデザイントークン、変数、テーマ、コンポーネント化された生成、アイコンフォントの統合を扱います。SVG と Iconify の書き出し、そしてデザインからコードへの経路を説明します。'
head:
    - [
          'meta',
          { property: 'og:title', content: '第38課 - デザインからコードへ' },
      ]
---

<script setup>
import IconLucide from '../../components/IconLucide.vue'
import IconButton from '../../components/IconButton.vue'
import ComponentsInstances from '../../components/ComponentsInstances.vue'
import DesignToCodeInterfaces from '../../components/DesignToCodeInterfaces.vue'
</script>

# 第 38 課 - デザインからコードへ {#lesson-38-from-design-to-code}

## 変数とテーマ {#variables-and-themes}

Pencil は、複数テーマの条件付き値を備えた完全なデザイントークンシステムに対応しています。詳しくは [Variables and Themes] を参照してください。変数はハードコーディングを減らします。AI モデルは具体的な色の値を出力する必要がなく（`#RRGGBB` の誤りが減ります）、デザインシステムのトークン表を覚える必要もありません。セマンティックな変数名だけで済み、レンダラーがその値を解決します。

```ts
api.setAppState({
    variables: {
        'color.background': { type: 'color', value: '#FFFFFF' },
        'text.title': { type: 'number', value: 72 },
    },
});
api.updateNodes([
    {
        id: 'r1',
        type: 'rect',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        zIndex: 1,
        fill: '$color.background',
        stroke: '$color.background',
    },
]);
```

AI モデルがダークモード向けにデザインするとき、パレットを 2 組そろえる必要はありません。`$color.bg` のような参照だけで済み、ノードの `theme` が解決された値を決めます。

```json
"variables": {
  "color.bg": {
    "type": "color",
    "value": [
      { "value": "#FFFFFF", "theme": { "mode": "light" } },
      { "value": "#000000", "theme": { "mode": "dark" } }
    ]
  }
}
```

AI モデルはピクセル値を計算したり、レスポンシブなブレークポイントを結線したりする必要もありません。意図を宣言的に述べると、レイアウトエンジンがジオメトリを計算します。詳しくは [第 33 課 - レイアウトエンジン][Lesson 33 - Layout engine] を参照してください。

### 変数の種類 {#variable-types}

Figma は 4 種類の変数に対応しています。詳しくは [Guide to variables in Figma] を参照してください。

-   色（`#000000`）
-   数値
-   文字列。例: `fontFamily` やテキスト内容
-   ブール値

![出典: https://help.figma.com/hc/en-us/articles/14506821864087-Overview-of-variables-collections-and-modes](https://help.figma.com/hc/article_attachments/30211233510039)

![出典: https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections](https://help.figma.com/hc/article_attachments/26964398869143)

### プロパティパネルと変数ピッカー {#property-panel-and-variable-picker}

ノードを選択した状態で、Spectrum のプロパティパネルは `AppState.variables` のデザイン変数を **塗り / ストローク色 / ストローク幅 / フォントサイズ** にバインドできます。ドロップダウンから名前を選ぶと `$token` が書き込まれます。バインドされると紫色のバッジが表示され、1 回の操作で **バインド解除** できます（現在解決されているリテラルを書き戻し、履歴に記録します）。カラーピッカーとストローク幅のスライダーは常に **解決済み** の値を示すため、生の `$...` が不正な CSS 色として使われることはありません。

### SVG の書き出し {#export-svg}

書き出し戦略は複数あり、デフォルトは解決済みのリテラルです。

```ts
export type DesignVariablesSvgExportMode =
    /** Resolve $ → literal */
    | 'resolved'
    /** Keep `$token` strings (attributes may be non-standard; good for post-processing) */
    | 'preserve-token'
    /** `:root{--x:...}` + `fill="var(--x)"` */
    | 'css-var';
```

CSS 変数モードも使えます。グローバル値は `:root` の下に宣言されるので、開発者ツールで調整できます。詳しくは [Using CSS custom properties (variables)] を参照してください。

```html
<svg>
    <defs>
        <style>
            :root {
                --color-background: #2563eb;
                --color-stroke: red;
                --text-title: 72px;
            }
        </style>
    </defs>
    <rect
        fill="var(--color-background)"
        stroke="var(--color-stroke)"
        stroke-width="2"
        width="100"
        height="100"
        id="node-r1"
    />
</svg>
```

## アイコン {#icon}

アイコンは UI を生成するときに重要です。[Lucide] はすでに React のコード生成で広く使われており、Pencil も同様の組み込みグラフィックに対応しています。

```ts
export interface IconFont extends Entity, Size, CanHaveEffects {
    type: 'icon_font';
    /** Name of the icon in the icon font */
    iconFontName?: StringOrVariable;
    /** Icon font to use. Valid fonts are 'lucide', 'feather', 'Material Symbols Outlined', 'Material Symbols Rounded', 'Material Symbols Sharp', 'phosphor' */
    iconFontFamily?: StringOrVariable;
    /** Variable font weight, only valid for icon fonts with variable weight. Values from 100 to 700. */
    weight?: NumberOrVariable;
    fill?: Fills;
}
```

OpenPencil では、`iconLookup` は注入可能な関数です。これは次を意味します。

-   **柔軟性**: 任意のアイコンソースを使えます（Iconify、Lucide、カスタム）。
-   **モデルの負荷**: AI モデルは `iconFontName: "SearchIcon"` だけを出力します。パスはランタイムが解決します。

```ts
private drawIconFont(canvas, node, x, y, w, h, opacity) {
  const iconName = iNode.iconFontName ?? iNode.name ?? '';
  const iconMatch = this.iconLookup?.(iconName) ?? null;
  const iconD = iconMatch?.d ?? FALLBACK_ICON_D;  // SVG path data
  const iconStyle = iconMatch?.style ?? 'stroke';   // stroke or fill

  // Resolve SVG path → Skia path → scale → draw
}
```

私たちの定義は次のとおりです。

```ts
export interface IconFontAttributes {
  /** Name of the icon in the font family */
  iconFontName?: StringOrVariable;
  /**
   * Font family, e.g. 'lucide', 'feather', 'Material Symbols Outlined', 'phosphor', etc.
   */
  iconFontFamily?: StringOrVariable;
}

export interface IconFontSerializedNode
  extends BaseSerializeNode<'iconfont'>,
  Partial<IconFontAttributes>;
```

### 実行時にアイコンを登録する {#register-icon-at-runtime}

[IconifyJSON] のアイコン型を使い、SVG を含む JSON を通して Lucide、Material などのセットを実行時に読み込みます。

```ts
import { registerIconifyIconSet } from '@infinite-canvas-tutorial/ecs';

const m = await import('@iconify/json/json/lucide.json');
registerIconifyIconSet('lucide', m);
```

アイコンの本文は、単一引用符または二重引用符の SVG 属性を受け付けます。パス、矩形、円、楕円、線は、自己終了タグまたは明示的な終了タグを使えます。入れ子の `<g>` の塗りとストローク属性は、その中の図形が継承します。

アイコン JSON は、これまでと同じ方法でシーングラフへ写像されます。Search アイコンは `Group` になり、子として `Path` と `Circle` を持ちます。SVG を私たちの図形へ変えるのとよく似ています。

```json
"search": {
    "body": "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"m21 21l-4.34-4.34\"/><circle cx=\"11\" cy=\"11\" r=\"8\"/></g>"
}
```

幅、高さ、`strokeWidth` も、変換後のグラフへ写像します。

```ts
function buildIconFontScalablePrimitives(
    iconFontName: string,
    iconFontFamily: string,
    targetWidth: number,
    targetHeight: number,
): ScaledIconPrimitive[] {}
```

<IconLucide />

### レイヤーパネルでの表示 {#display-in-the-layer-panel}

Iconify は表示用の Web Components を提供しています。詳しくは [Iconify Icon web component] を参照してください。レイヤー一覧のサムネイルにこれを使います。

```ts
import 'iconify-icon';

if (this.node.type === 'iconfont') {
    const iconName = this.#normalizeIconifyName(
        this.node as IconFontSerializedNode,
    );
    thumbnail = iconName
        ? html`<iconify-icon icon=${iconName}></iconify-icon>`
        : html`<sp-icon-group></sp-icon-group>`;
}
```

### SVG の書き出し {#export-icon-to-svg}

### レイアウトとともにレンダリング {#render-component-with-layout}

[第 33 課 - レイアウトエンジン][Lesson 33 - Layout engine] と組み合わせると、アイコンを含むボタンを作れます。

```ts
const button1 = {
    id: 'icon-button',
    type: 'rect',
    fill: 'grey',
    display: 'flex',
    width: 200,
    height: 100,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    cornerRadius: 10,
    gap: 10,
} as const;

const searchIcon = {
    id: 'icon-button-search',
    parentId: 'icon-button',
    type: 'iconfont',
    iconFontName: 'search',
    iconFontFamily: 'lucide',
};

const text = {
    id: 'icon-button-text',
    parentId: 'icon-button',
    type: 'text',
    content: 'Button',
};
```

<IconButton />

[Shadcn UI] と同じ考え方で、複数の **バリアント** を持つ `Button` が必要です。同じ構造を何度も書かなくて済むようにするためです。

```tsx
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Destructive</Button>
```

## コンポーネントとスロット {#components-and-slots}

`.pen` ファイルの `ref` + `descendants` システムは、実質的に AI 向けのコンポーネント継承モデルです。AI モデルは低レベルの構成（角丸の矩形 + テキスト + パディング）を理解する必要がありません。デザインシステムにある既存の `round-button` を指し、ラベルを上書きできます。これはコードにおける「継承してから上書きする」という考え方と同じです。詳しくは [Components and Instances] を参照してください。

```json
{
    "id": "round-button",
    "type": "g",
    "reusable": true,
    "cornerRadius": 9999,
    "children": [
        {
            "id": "label",
            "type": "text",
            "content": "Submit",
            "fill": "#000000"
            ...
        }
    ]
}

{
    "id": "save-round-button",
    "type": "ref",
    "ref": "round-button",
    "descendants": { "label": { "content": "Save" } }
}
```

<ComponentsInstances />

## デザイン ↔ コード {#design-to-code}

[Design ↔ Code]

[Design ↔ Code] の重要な洞察は、design-to-code がピクセルからコードへの AI の推測では**ない**ということです。`.ic` 形式はすでにコード向けのプリミティブを符号化しています。flex レイアウト、デザイン変数、`reusable`/`ref` コンポーネント、セマンティックな名前、アイコンフォントです。そのためシーングラフ**そのもの**が、コード向けに作られた IR です。したがって中核は**決定的なトランスパイラ**であり、AI が助けるのは命名と構造整理の層だけです。

### パイプライン {#design-to-code-pipeline}

SVG 書き出しのパイプラインに倣いますが、フレームワークに依存しない **Code IR** を挟みます。新しい対象フレームワークの追加は、エミッターを 1 つ増やすだけになります。

```text
.ic SceneGraph
  → expandRefSerializedNodes   // reuse existing ref/reusable handling
  → CodeIR                     // element tree + structured style + token refs + component defs
  → Emitter                    // react-tailwind | html-css | ...
```

Code IR ノードが保持するのは、**役割**（コンテナ / テキスト / アイコン / 画像 / 図形）、**解決前の `$token` 参照**、構造化された **flex スタイル**、そして `reusable`/`ref` の**コンポーネント関係**です。

### エントリポイント {#design-to-code-entry}

`API.exportCode` は `renderToSVG` に対応します。引数がないときはシーン全体をトランスパイルし、ノードを渡すとその選択範囲をトランスパイルします。

```ts
const code = api.exportCode(undefined, {
    framework: 'react-tailwind', // or 'html-css'
    variablesMode: 'css-var', // 'resolved' | 'preserve-token' | 'css-var'
    componentStructure: 'preserve', // 'preserve' | 'flatten'
});
```

純粋関数を直接呼び出すこともできます。

```ts
import { serializedNodesToCode } from '@infinite-canvas-tutorial/ecs';

const code = serializedNodesToCode(nodes, {
    framework: 'react-tailwind',
    variables,
});
```

### 概念の対応 {#design-to-code-mapping}

| `.ic` の概念                                        | コード出力                                              |
| --------------------------------------------------- | ------------------------------------------------------- |
| `rect`/`g` + `display: flex`                        | `<div>` + flex ユーティリティ（`flex items-center …`）  |
| Flex の方向、揃え、サイズ、間隔、パディング         | Tailwind の flex ユーティリティ / CSS                   |
| flex でないコンテナ内の子の `x` / `y`               | そのコンテナを基準にした絶対配置                        |
| `cornerRadius` / `fills` / `strokes` / `dropShadow` | `rounded-* / bg-* / border / shadow-*`                  |
| 画像塗りのある `rect`                               | `<img src>` と `object-fit` / `object-position`         |
| CSS グラデーション塗りが 1 つの `rect`              | CSS `background-image`                                  |
| `ellipse`                                           | CSS `border-radius: 50%`                                |
| 単色の塗りとストロークがあるリーフ `path`           | ベクタージオメトリを持つインライン SVG `<path>`         |
| 単色ストロークがあるリーフ `line` / `polyline`      | 開いたベクタージオメトリを持つインライン SVG `<path>`   |
| `rect` / `ellipse` + `clipMode: clip`               | クリップ要素上の CSS `overflow: hidden`                 |
| `rotation` / `scaleX` / `scaleY`                    | ローカルの左上を基準とした CSS `transform`              |
| ノードレベルの `blendMode`                          | CSS `mix-blend-mode`                                    |
| `visibility: hidden` / `visible`                    | レイアウト空間を残す CSS の visibility                  |
| `text` + `content`                                  | テキストノード。既知の `$token` 内容 → テキスト値       |
| テキスト装飾の線、スタイル、色、太さ                | CSS `text-decoration`                                   |
| `fontVariant` / `fontKerning`                       | CSS `font-variant` / `font-kerning`                     |
| `wordWrap` / `wordWrapWidth`                        | `white-space`、`overflow-wrap`、`max-width`             |
| `maxLines` / `textOverflow`                         | CSS のラインクランプ、または切り取った行数              |
| `iconfont` (lucide)                                 | `lucide-react` の `<Search />`                          |
| `iconfont`（その他のファミリー）                    | `@iconify/react` の `<Icon icon="family:name" />`       |
| `$color.bg` 変数                                    | `bg-[var(--color-bg)]`（css-var）/ リテラル（resolved） |
| `reusable` ルート                                   | React コンポーネント定義                                |
| `ref` + `descendants` のオーバーライド              | props を持つコンポーネントインスタンス                  |
| `name`                                              | コンポーネント / prop / class 名                        |

### 変数モード {#design-to-code-variable-modes}

3 つの変数モードは、SVG 書き出しの意味と一致します。

-   `resolved`（デフォルト）: `$token` をリテラルに解決します（例: `bg-[#FFFFFF]`）。
-   `css-var`: スタイルに `var(--token)` を出力します（例: `bg-[var(--color-bg)]`）。HTML/CSS の書き出しには `:root { … }` ブロックが含まれます。React は定義を各書き出しコンポーネントにスコープし、単独で描画される reusable コンポーネントも含みます。入れ子のインスタンスは親のスコープを共有するため、別々の書き出しが同じトークンに異なる値を使えます。CSS カスタムプロパティはテキストノードを置き換えられないため、テキスト内容のトークンは現在の値に解決されます。
-   `preserve-token`: `$token` を保持します（後処理のためインライン `style` へ送ります）。

### コンポーネントとインスタンス {#design-to-code-components}

`componentStructure: 'preserve'`（デフォルトであり、Pencil の特長）では、各 `reusable` ルートがコンポーネントになり、すべての `ref` がインスタンスになります。インスタンス間で現れる上書き可能な属性（`content`、`fills`、`fontVariant` と `fontKerning` を含むタイポグラフィ、テキスト装飾、`opacity`、`visibility`、`cornerRadius`、明示的な `width`/`height`、`minWidth`/`maxWidth`/`minHeight`/`maxHeight`、`padding`、`margin`、flex の間隔、`flexDirection`、`alignItems`、`justifyContent`、`flexWrap`、`alignSelf`、`flexGrow`、`flexShrink`、`flexBasis`、`strokeWidth`、`strokes`、そしてドロップシャドウのフィールド）は、テンプレート値をデフォルトとして props に引き上げます。数値の `lineHeight` は `.ic` ではピクセル高さなので、React の出力は単位なしの倍率として扱わず `px` を付けます。ブール値の `fontKerning` は CSS の `normal` または `none` になります。間隔の配列は CSS のショートハンド文字列になり、テキスト装飾のフィールドは 1 つの prop にまとまり、シャドウのフィールドは 1 つの `boxShadow` prop にまとまります。太さ 0 の装飾は、キャンバスと同じく `none` として描画されます。

テキストの書き出しは、単位なしの `1.2` 行高を、明示的な `lineHeight` がないときに使い、ブラウザの flex 間隔をキャンバスのテキストメトリクスに近づけます。明示した数値の `lineHeight` は引き続きピクセルで書き出します。明示的な改行は `white-space: pre` で保持されます。`wordWrap` が有効で `wordWrapWidth` が正の値のとき、出力は `pre-wrap` と `overflow-wrap: anywhere` を使い、その幅を最大幅にします。正の `maxLines` は、`ellipsis`（デフォルト）には CSS のラインクランプを、`clip` には行高で切り取る上限を追加します。すでに折り返された reusable テキストの折り返し幅だけを編集すると、コンポーネントの prop になります。折り返しのオンとオフを切り替えたり、切り詰め設定を変更したりすると、インスタンスが展開され、書き出したレイアウトがその編集に従います。キャンバスは現在、テキスト計測に `whiteSpace` 設定を適用しません。カスタムの `textOverflow` マーカー文字列には、標準 CSS の同等物がありません。

reusable な画像では、画像 URL だけを変えると、インスタンスの `fills` オーバーライドがコンポーネントの `<img src>` prop に結び付きます。塗り種別、フィット、位置、塗り不透明度を変えるとインスタンスが展開され、生成される要素とスタイルがその編集を反映します。リーフの画像は、単一の塗り不透明度とノード不透明度を `<img>` 上で合成します。楕円の単一画像塗りは、角丸の `<img>` として書き出します。子を持つ画像塗り付きの矩形と楕円は、位置指定のラッパーを使い、装飾用の `<img>` をその子の背後に置きます。ラッパーがノード不透明度を持ち、`<img>` が塗り不透明度、フィット、位置を持ちます。

有効な CSS の線形、放射、または円錐グラデーション塗りが 1 つだけの矩形は、そのグラデーションを `background-image` として書き出します。インスタンスでグラデーション値だけを編集すると、コンポーネントの prop になります。単色、対応しているグラデーション、画像、またはパターンの塗りが複数ある矩形と楕円は、ペイント順に積み重ねた背景として書き出します。単一のパターンも CSS 背景として書き出します。キャンバスの `conic-gradient(circle at …)` 構文は、CSS の `conic-gradient(at …)` に変換されます。画像レイヤーは `fill`、`contain`、`cover`、`none`、`scale-down` と位置をサポートし、子コンテンツはペイントより手前に保ちます。パターンは本来のタイルサイズと繰り返し設定を保持します。独立した不透明度、画像の `scale-down`、または対応している 2D パターン変換が必要なペイントでは、ジェネレーターが子の背後にクリップされた装飾レイヤーを出力します。CSS が対応するレイヤーのブレンドモードは、塗りスタックの内部に留まります。パターン変換は、明示的な寸法を持つ矩形と楕円で `matrix`、`translate`、`scale`、`rotate`、`skewX`、`skewY` をサポートします。キャンバスは URL ベースのパターン画像もデコードし、これらの変換を適用します。reusable インスタンスでスタックまたはパターンを編集すると、そのインスタンスは展開されます。それ以外のグラデーション形式、未対応のパターン変換構文、`linearBurn` や `linearDodge` のように CSS に同等物がないブレンドモードは、引き続き個別の処理が必要です。

不透明度が 1 未満の単一の単色塗りは CSS の `color-mix` を通して書き出され、子要素を暗くせずに塗りアルファを保ちます。ノード不透明度は、別の CSS `opacity` のままです。reusable インスタンスで半透明の塗りを編集すると、そのインスタンスが展開され、生成されるペイントは不透明度を保ちます。

ノードの回転（ラジアンで保存）と `scaleX` / `scaleY` は、CSS の `rotate(...) scale(...)` 変換として原点 `0 0` とともに書き出され、キャンバスのローカル変換の順序と一致します。インスタンスの変換を編集すると、そのインスタンスが展開され、変更されたジオメトリが書き出しに含まれます。

`clipMode: clip` の矩形と楕円は、生成された HTML と React コードで子をクリップします。角丸の矩形は角の半径を保持し、楕円は `border-radius: 50%` を使います。reusable インスタンスのクリップモードを変更すると、そのインスタンスが展開され、クリップ状態が保持されます。`erase` と `soft` のマスクには CSS の overflow に直接対応するものがなく、クリップとしては書き出されません。

flex でないコンテナでは、子はキャンバス上のローカルな `x` / `y` を CSS の `left` / `top` 位置として使います。flex の子は通常の flex フローのままです。Yoga はこれらの `flexShrink` を既定で `0` にするため、ノードが別の値を指定しない限り、書き出しは `flex-shrink: 0` を設定します。flex でないコンテナ内の、保持されたコンポーネントインスタンスには位置指定のラッパーが付きます。インスタンス内の子を移動すると、そのインスタンスが展開されて編集が残ります。複数のトップレベルノードがすべて明示的なサイズを持つとき、書き出しは相対配置のフレームも追加し、回転および反転した境界を含めて間隔を保ちます。測定できるサイズがないルートは、通常の文書フローのままです。

ノードレベルの `visibility` は CSS の `visibility` になるため、非表示のノードはレイアウト空間を保ちます。既定の `inherited` 状態は CSS の継承を使います。reusable インスタンスの可視性を変更すると、子孫への編集を含めてコンポーネントの prop になります。

有効な `d` データを持つパスは、矩形のプレースホルダーではなくインライン SVG として書き出します。Path に子があるとき、その SVG は位置指定のラッパー内で子の背後に置かれ、ベクターの輪郭と各子のローカル座標を保ちます。単色、線形または放射グラデーション、画像から作られた塗りレイヤーは、キャンバス順に別々の SVG パスとして書き出され、各レイヤーの不透明度を保ちます。CSS が対応するブレンドモードは隔離された SVG グループの中で適用されるため、下にある塗りレイヤーとだけ合成されます。それらのペイント種別の有効なストロークは、ペイント、不透明度、線・三角形・菱形の端点マーカー、塗りルール、幅、キャップ、ジョイン、マイターリミット、ダッシュ設定を保持します。複数のストロークを持つパス、線、ポリラインは、共有ジオメトリと CSS が対応するレイヤー合成で、各ストロークをキャンバス順に書き出します。閉じたパスは、すべてのレイヤーをクリップまたはマスクすることで内側または外側のストローク揃えも保持します。開いたパスは中央揃えのままです。グラデーションと画像ペイントは、パスの viewBox に従います。パスの画像塗りは `fill`、`contain`、`cover`、`none`、`scale-down` をサポートし、中間のパーセント位置も含みます。一般的な `fill` / `contain` / `cover` の揃えは SVG パターンを使います。それ以外のフィットと位置は、クリップされた SVG `foreignObject` と CSS の `object-fit` / `object-position` を使います。画像ストロークは、位置が 0%、50%、100% の `fill`、`contain`、`cover` に SVG パターンを使います。別のフィットや位置を使う単一の画像ストロークは、位置指定の HTML 画像と SVG ジオメトリマスクを使い、Chromium と WebKit でキャップ、ジョイン、端点マーカー、内側または外側の揃えを保ちます。これらのフィットや位置を使う重なった画像ストロークも、SVG ストロークレイヤーとあわせて、キャンバスのペイント順、対応する CSS ブレンドモード、不透明度、端点マーカーを保持します。書き出したコードでは、永続的な画像 URL または data URL を使ってください。ドロップシャドウは SVG の図形に従い、Path の子には影を付けません。reusable インスタンス上のパスのペイント、ジオメトリ、マーカー、ストローク揃え、またはシャドウのオーバーライドは、そのインスタンスを展開し、SVG が編集を反映するようにします。`linearBurn` や `linearDodge` のように CSS に同等物がないブレンドモード、円錐グラデーションとメッシュグラデーション、その他のパスフィルターには、別途 SVG での処理が必要です。

リーフの線とポリラインは、同じ SVG パイプラインを使います。ローカルな端点または点リストは、塗りのない開いたパスになります。SVG の viewBox はジオメトリのローカル原点に従い、幅 0 または高さ 0 の軸を中央に置くため、オフセットしたパスや細い水平・垂直のストロークも生成コードの中で見えたままになります。ストロークには、有効な単色、線形グラデーション、放射グラデーション、または画像ペイントを 1 つ使えます。線、三角形、菱形の矢印は、ストロークのペイントを使うローカル SVG マーカーを使います。reusable な線またはポリラインのインスタンスに対するジオメトリ、ペイント、マーカーの編集も、そのインスタンスを展開します。それ以外の線の効果は、引き続き個別の処理が必要です。

ノードレベルの `blendMode` は CSS の `mix-blend-mode` になり、インスタンスがそれを変更する場合はコンポーネントの prop も含みます。`light` は CSS の `lighten` に対応します。CSS に同等物がないモードは SVG 書き出しに従い、`normal` として描画されます。塗りレイヤー自身の `blendMode` はそのノード内の他の塗りと合成され、ノードレベルの `mix-blend-mode` としては扱いません。

```tsx
interface RoundButtonProps {
    label?: string;
}

export function RoundButton({ label = 'Submit' }: RoundButtonProps) {
    return (
        <div className="flex items-center justify-center w-[120px] h-[40px] rounded-[9999px]">
            <span>{label}</span>
        </div>
    );
}

export function Design() {
    return <RoundButton label="Save" />;
}
```

`componentStructure: 'flatten'` はフォールバックです。`expandRefSerializedNodes` を通してすべてのインスタンスを、コンポーネント定義のない具体的な DOM へ展開します。HTML/CSS エミッターは、HTML にコンポーネントの概念がないため、常にフラット化します。

### 実用的なインターフェースの例 {#practical-interface-examples}

次の例は、分析ダッシュボード、SaaS の料金ページ、モバイルのチェックアウト画面を **IC エディターのキャンバス**に読み込みます。3 つのシーンはいずれも入れ子の flex レイアウトとセマンティックな色変数を使います。チェックアウトは 390 × 844 の狭いアートボードを使います。キャンバス上でノードを選択して編集し、`API.exportCode` でキャンバスの現在のドキュメントから生成したコードを更新、コピー、またはダウンロードしてください。HTML/CSS を選んだ状態では、**HTML プレビュー**を使い、生成されたページをアートボードサイズのままサンドボックスのフレームで表示します。デザインを切り替えると、編集できる別のシーンが読み込まれます。

例は、ノード ID をキーにした `semanticElements` マップを `API.exportCode` に渡します。このマップは、選んだキャンバスの矩形とテキストを、両方の書き出しで HTML ランドマーク、見出し、`<button type="button">` コントロールに変えます。このマップは、このデモの書き出し設定に属します。ボタンの動作とナビゲーションは、アプリケーション側で接続してください。

料金ページは、1 つの `reusable` なプランカードテンプレートと 3 つの `ref` インスタンスを使います。エディターはインスタンスを展開して描画と編集を行います。このデモは、テキスト、色、タイポグラフィとテキスト装飾、不透明度、明示的なサイズとサイズ制約、間隔、flex の揃えと項目サイズ、単色の境界、ドロップシャドウの編集を、React と `.ic` のダウンロード向けにインスタンスのオーバーライドへ戻します。Growth カードはアクセントの境界を示します。数値の `flexBasis` とサイズ制約の値は、HTML/CSS と React のスタイルでピクセル値になります。カードの構造、または未対応のプロパティが変わると、書き出しは展開したノードを使うため、結果は引き続きキャンバスと一致します。

3 つの React 書き出しは、React 19 と Tailwind CSS 4 を使ったブラウザテストでも描画されます。テストは主要なテキスト位置を HTML プレビューと照合し、ジェネレーターが変わってもこれらの例を実行できる状態に保ちます。

<DesignToCodeInterfaces />

`.ic` ファイルをダウンロードすると、[オンラインアプリ](https://app.infinitecanvas.cc/)で **Import from… > .ic** からデザインの編集を続けられます。HTML ファイルをダウンロードし、ブラウザで直接開いてください。React の場合は **React プロジェクトをダウンロード** を選ぶと、現在のキャンバスから Vite、React 19、Tailwind CSS 4 のスターター ZIP を取得できます。展開してから `pnpm install` と `pnpm dev` を実行してください。書き出したコンポーネントは `src/App.tsx` にあります。スターターは、デザインが Inter を使うとき、そのフォントをローカルにバンドルします。現在のキャンバスにある一時的な `blob:` 画像は `public/assets` にコピーされ、ローカルパスで参照されます。data URL はインラインのまま、リモート URL はリモートのままです。`src/responsive.css` は、この 3 つの例に狭い画面向けのレイアウトを追加し、`src/App.tsx` のアートボードサイズのコンポーネントは保ちます。既存のプロジェクト向けに `.tsx` ファイルだけをダウンロードすることもできます。ジェネレーターが現在出力するのは表示用のマークアップです。書き出しのあと、ナビゲーション、チェックアウトの操作、決済、ライブデータをアプリケーションのロジックへ接続してください。

### コマンドライン {#cli}

リポジトリには `.ic` ファイル向けのオフライン CLI も含まれています（Node.js 20 以降）。エディターで **Export as… > .ic** を使ってデザインを書き出し、`design.ic` として保存してください。リポジトリのルートで、ワークスペースの依存関係を順にビルドしてから実行してください。

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @infinite-canvas-tutorial/device-api build:cjs
corepack pnpm --filter @infinite-canvas-tutorial/ecs build:cjs
corepack pnpm --filter @infinite-canvas-tutorial/cli build
node packages/cli/dist/cli.js validate design.ic
node packages/cli/dist/cli.js inspect design.ic --json
node packages/cli/dist/cli.js codegen design.ic --framework react-tailwind --variables-mode css-var --component-name Design --output Design.tsx
node packages/cli/dist/cli.js codegen design.ic --framework html-css --output design.html
```

`inspect --json` は、ノード数とルート数、reusable ノード、変数、アセット URL の数を報告します。`--output` を省くと、生成されたコードが標準出力へ表示されます。無効なドキュメントやオプションは、エラーメッセージとともに 0 以外の終了ステータスを返します。CLI は、エディターのコードジェネレーターと同じ React コンポーネントまたは HTML/CSS 断片を出力します。ドキュメントの変数とテーマを使い、オンラインのプロジェクトにはアクセスせず、ブラウザの外では存続できない一時的な `blob:` 画像は拒否します。書き出したドキュメントでは、data URL または永続的な画像 URL を使ってください。

### 逆方向: コード → デザイン {#design-to-code-reverse}

逆方向（JSX/HTML の AST を `.ic` ノードへ解析し戻すこと）はより難しく、曖昧さも大きいため、第 2 段階として残しています。推奨する最初の到達点は、任意の手書きコードへ広げる前に、このトランスパイラが出力するコードの**冪等なラウンドトリップ**（デザイン → コード → デザイン、情報損失なし）です。

## さらに読む {#extended-reading}

[Variables and Themes]: https://docs.pencil.dev/for-developers/the-pen-format#variables-and-themes
[Guide to variables in Figma]: https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma
[Using CSS custom properties (variables)]: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties
[Design ↔ Code]: https://docs.pencil.dev/design-and-code/design-to-code
[Lesson 33 - Layout engine]: /ja/guide/lesson-033
[IconifyJSON]: https://iconify.design/docs/types/iconify-json.html
[Iconify Icon web component]: https://iconify.design/docs/iconify-icon/
[Lucide]: https://lucide.dev/icons
[Shadcn UI]: https://ui.shadcn.com/docs/components/radix/button
[Components and Instances]: https://docs.pencil.dev/for-developers/the-pen-format#components-and-instances
