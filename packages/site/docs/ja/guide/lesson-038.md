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

キャンバスのノードは用途に応じて、レイアウト、テキスト、画像、または SVG に変換されます。`reusable` と `ref` は React コンポーネントとインスタンスになり、変数は選択したモードで書き出されます。[対応表の全体](/ja/guide/design-to-code-reference#concept-mapping) を参照してください。

### 変数モード {#design-to-code-variable-modes}

3 つの変数モードは、SVG 書き出しの意味と一致します。

-   `resolved`（デフォルト）: `$token` をリテラルに解決します（例: `bg-[#FFFFFF]`）。
-   `css-var`: スタイルに `var(--token)` を出力します（例: `bg-[var(--color-bg)]`）。HTML/CSS の書き出しには `:root { … }` ブロックが含まれます。React は定義を各書き出しコンポーネントにスコープし、単独で描画される reusable コンポーネントも含みます。入れ子のインスタンスは親のスコープを共有するため、別々の書き出しが同じトークンに異なる値を使えます。CSS カスタムプロパティはテキストノードを置き換えられないため、テキスト内容のトークンは現在の値に解決されます。
-   `preserve-token`: `$token` を保持します（後処理のためインライン `style` へ送ります）。

### コンポーネントとインスタンス {#design-to-code-components}

既定の `componentStructure: 'preserve'` は、`reusable` を React コンポーネントに、`ref` をインスタンスに変換します。対応するテキスト、スタイル、レイアウトの変更は props になり、props で表せない変更はインスタンスを展開して外観を保ちます。

テキスト、画像、塗り、Path、クリッピング、ブレンドのルールは [書き出しの詳細](/ja/guide/design-to-code-reference) を参照してください。

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

IC エディターのキャンバスで、ダッシュボード、料金ページ、モバイル決済画面を編集し、現在のキャンバスからコードを生成・コピー・ダウンロードできます。HTML/CSS を選び **HTML preview** で結果を確認できます。料金ページは再利用可能なカードを使います。

<DesignToCodeInterfaces />

`.ic` は[オンラインアプリ](https://app.infinitecanvas.cc/)で再編集でき、HTML はブラウザーで開けます。**Download React project** の ZIP を展開し、`pnpm install` と `pnpm dev` で実行できます。生成されるのは表示部分です。ナビゲーション、決済、データはアプリに接続してください。詳細は[書き出しの詳細](/ja/guide/design-to-code-reference#practical-interface-examples)を参照してください。

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
