---
outline: deep
description: 'TextMetrics、HarfBuzz によるシェイピング、テキストの分割、BiDi 対応、SDF アトラスの生成、国際的なタイポグラフィのための絵文字処理を含む、複雑なテキストレンダリングを学びます。'
head:
    - [
          'meta',
          { property: 'og:title', content: '第15課 - テキストレンダリング' },
      ]
---

<script setup>
import MSDFText from '../../components/MSDFText.vue';
import BitmapFont from '../../components/BitmapFont.vue';
import Emoji from '../../components/Emoji.vue';
import Bidi from '../../components/Bidi.vue';
import TextBaseline2 from '../../components/TextBaseline2.vue';
</script>

# 第 15 課 - テキストレンダリング {#lesson-15-text-rendering}

テキストレンダリングは非常に複雑な処理です。[State of Text Rendering 2024] が詳しい解説を提供しているので、一読を強く勧めます。

この課では次の内容を学びます。

-   TextMetrics とは何か、サーバー側とブラウザ側でどう取得するか
-   シェイピング（Shaping）とは何か
-   テキストの分割と自動改行、BiDi、複合文字
-   SDF アトラスを生成して描画に使う方法
-   絵文字の扱い方

ブラウザが提供する Canvas 2D の [Drawing text] や SVG に慣れた開発者にとって、テキストレンダリングの複雑さは想像を超えることがあります。次の図は [Modern text rendering with Linux: Overview] からのもので、テキストからグリフ、ラスタライズ、そして最終的に画面へ描画するまでのデータフローを示しています。[HarfBuzz]、[FreeType]、Bidi、そして現在最も普及しているフォント形式、OpenType については、後ほど簡単に紹介します。興味深いことに、HarfBuzz は「open type」を意味するペルシア語の名前です。

![テキストレンダリングのデータフロー](https://mrandri19.github.io/assets/images/modern-text-rendering-linux-overview/overview.svg)

これまでの Web ベースの可視化プロジェクトでの経験からすると、[Text rendering in mapbox] のほうが実践的な参考になります。前述の処理連鎖にあるツールのほとんどには直接触れないためです。それでも、処理の流れをできる限り理解しておくと、テキストレンダリングの本質をつかむ助けになります。

## シェイピング {#shaping}

入力から始めましょう。テキストとフォントが与えられ、フォントは `fontstack` 形式で渡されるため配列になります:

```json
{
    "text-field": "Hey",
    "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"]
}
```

::: info fontstack
fontstack は、優先フォントと任意のフォールバックフォントからなる順序付きのリストです。
<https://docs.mapbox.com/help/troubleshooting/manage-fontstacks/>
:::

シェイピングとは何でしょうか。次の図は [Text rendering in mapbox] からのもので、要するに各文字の位置を順番に配置することです。もちろん、改行に出会う場合など、多くの状況を考慮します。

![シェイピング](https://cloud.githubusercontent.com/assets/375121/22094138/068c663a-ddc0-11e6-8b70-3866cb8af02a.gif)

次の図は [Modern text rendering with Linux: Overview] からのものです。

![HarfBuzz](https://mrandri19.github.io/assets/images/modern-text-rendering-linux-overview/harfbuzz.svg)

文字を正しく配置するには TextMetrics を取得する必要があります。最も単純な横並びの配置でも、少なくとも各文字の幅は知る必要があります。以下では、ブラウザ側で取得する方法に焦点を当てます。

### TextMetrics {#textmetrics}

HTML 仕様は [TextMetrics] の定義を示しており、水平方向と垂直方向の 2 組に分かれています:

```ts
// @see https://html.spec.whatwg.org/multipage/canvas.html#textmetrics
interface TextMetrics {
  // x-direction
  readonly attribute double width; // advance width
  readonly attribute double actualBoundingBoxLeft;
  readonly attribute double actualBoundingBoxRight;

  // y-direction
  readonly attribute double fontBoundingBoxAscent;
  readonly attribute double fontBoundingBoxDescent;
  readonly attribute double actualBoundingBoxAscent;
  readonly attribute double actualBoundingBoxDescent;
  readonly attribute double emHeightAscent;
  readonly attribute double emHeightDescent;
  readonly attribute double hangingBaseline;
  readonly attribute double alphabeticBaseline;
  readonly attribute double ideographicBaseline;
};
```

まず水平方向の 3 つの属性に注目します。次の図は [Differences between width and actualBoundingBoxLeft(Right)] からのもので、`width` と `actualBoundingBoxLeft/Right` のあいだに差があることがわかります。簡単に言うと、後者は文字の最大境界を表します（垂直方向の `actualBoundingBoxAscent/Descent` も同様です）。一方、前者（青）は後者の和（赤 + 緑）より小さくなることが十分にあり得ます。たとえば図の右側にあるイタリックの `f` は、font-kerning を考慮すると、次の文字も `f` であれば、この 2 つの `f` を互い違いに並べることができます。

![width と actualBoundingBoxLeft(Right)](/text-metrics.png)

垂直方向の属性を見てみましょう。次の図は [Meaning of top, ascent, baseline, descent, bottom, and leading in Android's FontMetrics] からのものです。まず `text-baseline` を見つけます。`Ascent/Descent` で終わるプロパティは、これを基準にします。

![Android の FontMetrics](/text-metrics2.png)

`text-baseline` の値は [text-baseline] を参照でき、下図のとおりです。たとえば `hanging` を取ると、`hangingBaseline` の値は `0` になり、`alphabeticBaseline` の値は `alphabetic` から `hanging` までの距離になります。

![text-baseline](/text-baseline.png)

最後に、`fontBoundingBoxAscent/Descent` はフォント自体の最大境界であり、`actualBoundingBoxAscent/Descent` は実際に描画したときのフォントの最大境界です。したがって前者は、内容が変わっても高低がばらつかない、一貫したテキスト背景を描くのに向いています。

<TextBaseline2 />

### measureText {#measuretext}

[TextMetrics] はどう取得するのでしょうか。Canvas 2D API は [measureText] を提供しますが、実際に使うときは `width` しか使えない場合を考慮する必要があります。[PIXI.TextMetrics] を例にすると、実装でこの点を考慮しており、`actualBoundingBoxLeft/Right` がどちらも `0` なら `width` を使います:

```ts
let textMetrics = PIXI.TextMetrics.measureText('Your text', style);

// @see https://github.com/pixijs/pixijs/blob/dev/src/scene/text/canvas/CanvasTextMetrics.ts#L334
const metrics = context.measureText(text);
let metricWidth = metrics.width;
const actualBoundingBoxLeft = -metrics.actualBoundingBoxLeft;
const actualBoundingBoxRight = metrics.actualBoundingBoxRight;
let boundsWidth = actualBoundingBoxRight - actualBoundingBoxLeft;
return Math.max(metricWidth, boundsWidth);
```

フォント関連の属性では、`Ascent/Descent` を計測できるように代表的な文字をいくつか選び、取得できなければユーザーが手入力した `fontSize` の値を使います。

```ts
// @see https://github.com/pixijs/pixijs/blob/dev/src/scene/text/canvas/CanvasTextMetrics.ts#L779
context.font = font;
const metrics = context.measureText(
    CanvasTextMetrics.METRICS_STRING + // |ÉqÅ
        CanvasTextMetrics.BASELINE_SYMBOL, // M
);

const properties = {
    ascent: metrics.actualBoundingBoxAscent,
    descent: metrics.actualBoundingBoxDescent,
    fontSize:
        metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
};

if (fontProperties.fontSize === 0) {
    fontProperties.fontSize = style.fontSize as number;
    fontProperties.ascent = style.fontSize as number;
}
```

Canvas 2D API を使う以外にも、ブラウザ側には次の選択肢があります。

-   [opentype.js]
-   use-gpu は [ab-glyph](https://github.com/alexheretic/ab-glyph) ベースの [use-gpu-text] を使います
-   ますます多くのアプリケーションが [harfbuzzjs] を使っています。参照: [State of Text Rendering 2024]

> Web で HarfBuzz を使う動きは増えています。最初は JavaScript へトランスパイルされ、最近では harfbuzzjs を通じて WebAssembly へクロスコンパイルされています。オンラインの写真編集アプリ Photopea などがこの方法を使います。Simon Cozens による Crowbar は、HarfBuzz の buffer-messaging API で作られた OpenType シェイピングのデバッガ Web アプリです。Sploot は Simon によるもう一つの Web アプリで、フォントインスペクタです。Prezi と [Figma](https://www.figma.com/) も Web アプリで HarfBuzz を使っています。

[What HarfBuzz doesn't do] にあるとおり、個々の文字の計測問題を解くだけではまったく不十分です。次に `letterSpacing` を考えます。

> HarfBuzz は、シェイピング済みテキストの幅を知らせてくれます。これは両端揃えアルゴリズムへの有用な入力です。しかし段落、行、行の長さについては何も知りません。単語を 1 行の中へ比例して収めるために **単語間の間隔を調整** することもしません。

### letterSpacing {#letterspacing}

Canvas 2D API は文字間隔を調整できる [letterSpacing] を提供します。テキストを計測する前にこれを設定します:

```ts
measureText(
    text: string,
    letterSpacing: number, // [!code ++]
    context: ICanvasRenderingContext2D
) {
    context.letterSpacing = `${letterSpacing}px`; // [!code ++]
    // Omitted measurement process
}
```

その後、各文字の位置を並べるときにも考慮する必要があり、[クアッドの生成](#generate-quads) で紹介します。

## 段落レイアウト {#paragraph-layout}

個々の文字が集まって文になり、文が集まって段落になります。次の図は [Text layout is a loose hierarchy of segmentation] からのもので、テキストレイアウトの階層構造を下から上へ示しています。

![レイアウトのピラミッド](https://raphlinus.github.io/assets/layout_pyramid.svg)

Canvas 2D API はテキスト描画で段落に関する機能を提供せず、最も基本的な [Drawing text] 関数だけを提供します。Skia ベースの CanvasKit はこれを拡張し、`drawParagraph` メソッドを追加で提供します。参照: [CanvasKit Text Shaping]

> CanvasKit が HTML Canvas API に対して提供する最大の機能の一つが **段落シェイピング** です。

```ts
const paragraph = builder.build();
paragraph.layout(290); // width in pixels to use when wrapping text
canvas.drawParagraph(paragraph, 10, 10);
```

段落の分割から始めましょう。

### 段落の分割 {#paragraph-segmentation}

最も単純な分割の根拠は、明示的な改行です。

```ts
const newlines: number[] = [
    0x000a, // line feed
    0x000d, // carriage return
];
```

加えて、自動改行も考慮する必要があります。同時に、各行の長さができるだけ揃うようにします。参照: [Beautifying map labels with better line breaking]

```ts
const breakingSpaces: number[] = [
    0x0009, // character tabulation
    0x0020, // space
    0x2000, // en quad
    0x2001, // em quad
    0x2002, // en space
    0x2003, // em space
    0x2004, // three-per-em space
    0x2005, // four-per-em space
    0x2006, // six-per-em space
    0x2008, // punctuation space
    0x2009, // thin space
    0x200a, // hair space
    0x205f, // medium mathematical space
    0x3000, // ideographic space
];
```

CJK では、行頭に置けない文字と、行末に置けない文字があります。たとえば中国語では、ほとんどの句読点を行頭に置けません。具体的な規則は [Line breaking rules in East Asian languages] を参照してください。[pixi-cjk] はこうした状況を処理します。

![pixi-cjk](https://github.com/huang-yuwei/pixi-cjk/raw/main/docs/screenshot.png)

自動改行のもう一つのよくある場面は、最大幅を指定し、それを超えたテキストを次の行へ折り返す場合です。さらに最大行数を設定でき、この上限を超えると [text-overflow] プロパティが適用されます。

```ts
{
    wordWrap: true,
    wordWrapWidth: 100,
    maxLines: 3,
    textOverflow: TextOverflow.ELLIPSIS,
}
```

Pixi.js の実装を参照できます。[CanvasTextMetrics]

```ts
for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const prevChar = text[i - 1];
    const nextChar = text[i + 1];
    const charWidth = calcWidth(char);

    if (currentWidth > 0 && currentWidth + charWidth > maxWidth) {
        if (currentIndex + 1 >= maxLines) {
            // 超出最大行数，添加省略号
            appendEllipsis(currentIndex);
            break;
        }

        currentIndex++;
        currentWidth = 0;
        lines[currentIndex] = '';

        if (isBreakingSpace(char)) {
            continue;
        }
    }
}
```

### BiDi {#bidi}

HarfBuzz は [BiDi] を処理しません。[What HarfBuzz doesn't do] を参照してください。

> HarfBuzz は双方向性については助けてくれません。

::: info BiDi
左から右（英語）と右から左（アラビア語またはヘブライ語）が混在するテキストを扱うためのサポートです。
:::

たとえば LTR と RTL が混在する内容 `ABCאבגDEF` では、正しい表示にするために RTL テキストの順序を手動で変える必要があります:

```ts
'ABCאבגDEF'.split(''); // ['A', 'B', 'C', 'ג' ,'ב' ,'א', 'D', 'E', 'F']
```

この問題はブラウザでは簡単には解けません。参照: [BiDi in Pixi.js]。[mapbox-gl-rtl-text] と [rtl-text] は [International Components for Unicode (ICU)] を WASM へ移植しましたが、JS バンドルのサイズが増えます。ただし現時点では [bidi-js] で処理でき、RTL 文字に出会ったら手動で順序を反転する必要があります:

```ts
import bidiFactory from 'bidi-js';

this.#bidi = bidiFactory();
const embeddingLevels = this.#bidi.getEmbeddingLevels(text);
let bidiChars = '';
for (const segment of segmentStack[0]!) {
    const { text, direction } = segment;
    bidiChars += direction === 'ltr' ? text : text.split('').reverse().join('');
}
```

印刷されたアラビア語では、各文字が「独立形（isolated）」「語頭形（initial）」「語中形（medial）」「語末形（final）」を持ち得ます。例として、アラビア文字「meem」（U+0645）の 4 つの形を示します。参照: [Improving Arabic and Hebrew text in map labels]。

![Copyright © 2015–2017 W3C® https://w3c.github.io/alreq/](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*bw5EsYu7dRATHtvg.png)

ICU と比べてはるかに軽量な [JavaScript-Arabic-Reshaper] を選びます。

```ts
import ArabicReshaper from 'arabic-reshaper';

if (direction === 'ltr') {
    bidiChars += text;
} else {
    bidiChars += ArabicReshaper.convertArabic(text)
        .split('')
        .reverse()
        .join('');
}
```

<Bidi />

BiDi を解決した次は、複合文字の問題に取り組む必要があります。次の例は、Rust で実装された複数行テキスト処理ライブラリ [cosmic-text](https://github.com/pop-os/cosmic-text/blob/166b59f560c551dab391a864f7c1f503c1e18446/examples/editor-test/src/main.rs#L97-L101) からのものです。

```rust
for line in BidiParagraphs::new(&text) {
    for grapheme in line.graphemes(true) {
        for c in grapheme.chars() {}
    }
}
```

### 複合文字 {#cluster}

すべての文字が単一の文字で構成されるわけではありません。[clusters] は、HarfBuzz が複合文字を扱うときに使う用語です。

> テキストシェイピングにおいて、クラスタとは、単一の分割できない単位として扱う必要がある文字の並びです。

たとえば絵文字がそうです。単一の文字として処理すると（たとえば `split('')` を使うと）、計測でもその後の描画でも誤って切り詰められます:

```ts
'🌹'.length; // 2
'🌹'[0]; // '\uD83C'
'🌹'[1]; //'\uDF39'
```

ブラウザ側では [grapheme-splitter] のようなライブラリを使え、使い方は次のとおりです:

```ts
var splitter = new GraphemeSplitter();
// plain latin alphabet - nothing spectacular
splitter.splitGraphemes('abcd'); // returns ["a", "b", "c", "d"]
// two-char emojis and six-char combined emoji
splitter.splitGraphemes('🌷🎁💩😜👍🏳️‍🌈'); // returns ["🌷","🎁","💩","😜","👍","🏳️‍🌈"]
```

ただしそのサイズ（圧縮後も 22kB）は無視できません。[BundlePhobia grapheme-splitter] を参照してください。そのため Pixi.js では、既定でブラウザ自身の [Intl.Segmenter] を使って複合文字を処理します。この機能はほとんどのモダンブラウザでサポートされています:

```ts
// @see https://github.com/pixijs/pixijs/blob/dev/src/scene/text/canvas/CanvasTextMetrics.ts#L121C19-L131C10
const splitGraphemes: (s: string) => string[] = (() => {
    if (typeof (Intl as IIntl)?.Segmenter === 'function') {
        const segmenter = new (Intl as IIntl).Segmenter();

        return (s: string) => [...segmenter.segment(s)].map((x) => x.segment);
    }

    return (s: string) => [...s];
})();
```

私たちもこの方法を採用し、後で文字の SDF を生成するときに使います。

### text-align {#text-align}

[text-align] の実装は簡単です。

![text-align](/text-align.png)

```ts
let offsetX = 0;
if (textAlign === 'center') {
    offsetX -= width / 2;
} else if (textAlign === 'right' || textAlign === 'end') {
    offsetX -= width;
}
```

一方、垂直方向の揃えを実装するのはそれほど簡単ではありません。[text-baseline] は単一行テキスト向けであり、多くの場面では段落全体を中央に揃えたいことがあります。flex レイアウトを扱うときに紹介します。

## レンダリング {#rendering}

次の図は、この処理の中での [FreeType] フォントレンダリングエンジンの位置を示しています。

![FreeType](https://mrandri19.github.io/assets/images/modern-text-rendering-linux-overview/freetype.svg)

具体的なテキストレンダリング手法に焦点を当てましょう。文字集合が限られたラテン文字なら、グリフアトラスをオフラインで生成し、実行時に GPU へアップロードすることが十分可能です。[freetype-gl] はこの方法で実装されています。

> グリフアトラスは、タイルの残りのデータとともに GPU へテクスチャとしてアップロードされる 1 枚の画像です。次はグリフアトラスを視覚的に表したものです。

次の図は [Drawing Text with Signed Distance Fields in Mapbox GL] からのものです。

![グリフアトラス](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*POsS7DlWOnqaJXI_.jpg)

ただし、この非ベクトル方式の問題は、拡大すると文字が非常にぼやけることです。次の図は [Distance field fonts] からのものです。

![距離フィールドフォントは鮮明さを保つ](https://libgdx.com/assets/wiki/images/distance-field-fonts.png)

現在主流の SDF ベースの手法は、Valve の論文 [Improved Alpha-Tested Magnification for Vector Textures and Special Effects] に由来します。この手法の利点は次のとおりです。

-   拡大しても鮮明さを保ちます
-   アンチエイリアス、ハロー（Halo）、影などの機能を実装しやすいです

ただし、エッジが十分に鋭くないという問題があります。可視化の場面では許容範囲はより広く、msdf などの方法で最適化することもできます。加えて、SDF は [font hinting] もサポートできません。

まず単一文字の SDF 生成の様子を見てみましょう。

### SDF の生成 {#generate-sdf}

次の図は [msdf-atlas-gen] からのもので、SDF と MSDF という 2 種類のアトラスに注目します。

|                   | ハードマスク | ソフトマスク | SDF  | PSDF | MSDF | MTSDF |
| ----------------- | ------------ | ------------ | ---- | ---- | ---- | ----- |
| チャンネル:       | 1 (1-bit)    | 1            | 1    | 1    | 3    | 4     |
| アンチエイリアス: | -            | はい         | はい | はい | はい | はい  |
| 拡大可能:         | -            | -            | はい | はい | はい | はい  |
| 鋭い角:           | -            | -            | -    | -    | はい | はい  |
| ソフト効果:       | -            | -            | はい | -    | -    | はい  |
| ハード効果:       | -            | -            | -    | はい | はい | はい  |

オフライン生成が許されるなら、[msdf-atlas-gen] か [node-fontnik] を使えます（mapbox はサーバー側で protocol buffer エンコードされた SDF を生成するのにこれを使います）。ただし CJK 文字を考慮すると、実行時の生成には [tiny-sdf] を使え、使い方は次のとおりです。フォント関連の属性を渡すと、ピクセルデータが得られます。

```ts
const tinySdf = new TinySDF({
    fontSize: 24,
    fontFamily: 'sans-serif',
});
const glyph = tinySdf.draw('泽'); // Contains pixel data, width and height, character metrics, etc.
```

生成の原理を簡単に分析しましょう。まず、ブラウザの Canvas2D API [getImageData] でピクセルデータを取得しますが、書き込むときにはバッファの余白を残します。これはハロー（Halo）の実装を考慮したものです。

```ts
const size = (this.size = fontSize + buffer * 4);
```

最も力任せの走査 $O(n^2)$ は到底受け入れられません。300K の画像なら距離計算が 900 億回になるため、実行時に終えるには効率的な $O(n)$ のアルゴリズムが必要です。

2 次元グリッドでは、距離フィールドの「距離」はユークリッド距離なので、EDT（Euclidean Distance Transform）は次のように定義されます。ここで $(x',y')$ は形状を構成する点の集合であり、$f(x, y)$ はサンプルされた関数です。グリッド上で $(x,y) \in P$ なら $f(x, y) = 0$、そうでなければ $\infty$ です。

$$ \mathcal{D}_f(x,y) = \min_{x',y'} \left( (x - x')^2 + (y - y')^2 + f(x', y') \right) $$

ここで最初の部分は $y'$ と無関係なので、2 回の 1 次元 DT 計算に展開できます。1 回目は $x'$ を固定します。

$$
\begin{align*}
\mathcal{D}_f(x,y) &= \min_{x'} \left( (x - x')^2 + \min_{y'} \left( (y - y')^2 + f(x', y') \right) \right), \\
&= \min_{x'} \left( (x - x')^2 + \mathcal{D}_{f_{|x'}}(y) \right),
\end{align*}
$$

したがって、1 次元の距離の二乗だけを考えれば十分です。

$$ \mathcal{D}_f(p) = \min_{q \in \mathcal{G}} \left( (p - q)^2 + f(q) \right) $$

上の 1 次元距離二乗フィールドの計算式を幾何学的に理解すると、実際には放物線の集合です。各放物線の最低点は $(q, f(q))$ にあり、次の図は原論文 [Distance Transforms of Sampled Functions] からのものです。

![サンプルされた関数の距離変換](/dt-sampled-functions.png)

したがって、この放物線の集合の下界、つまり次の図の実線部分が EDT の計算結果を表します。

![EDT](https://pica.zhimg.com/v2-2dd0b94f2de83162f314300b933a3708_1440w.jpg)

この下界を求めるには、任意の 2 本の放物線の交点を計算する必要があります。たとえば 2 本の放物線 $(x=r, x=q)$ について、交点の横座標 $s$ は次のとおりです。

$$ s = \frac{(f(r) + r^2) - (f(q) + q^2)}{2r - 2q} $$

これで EDT 1D を計算する準備が整いました。下界の中で最も右にある放物線の番号を $v[]$ に保存します。下界の放物線の各区間の境界は $z[]$ に保存します。こうすると、次の放物線 $x=q$ を計算するときは $v[k]$ の放物線との交点だけを求めればよく、交点の横座標と $z[k]$ の位置関係は 2 通りしかありません。

![これまでに構築した下側包絡に q の放物線を追加するとき、アルゴリズムが考慮する 2 つの場合](/dt-2-possible-cases.png)

完全なアルゴリズムは次のとおりで、[tiny-sdf] がこれを実装しています（EDT 1D）。変数名まで一致しています。

![二乗ユークリッド距離のもとでの 1 次元距離変換](/dt-euclidean-distance.png)

[Sub-pixel Distance Transform] はこのアルゴリズムの考え方を詳しく紹介しています。内側の距離フィールドと外側の距離フィールドを別々に計算し、その後 2 つを合成します。

> 符号付き距離フィールドを作るには、内側と外側のそれぞれに対してこれを行い、その後 2 つを内側 − 外側、またはその逆として合成します。

最も基本的な 1D から始まります。まず入力が白黒だけ、つまり前述のハードマスクだと仮定し、最初に外側の距離フィールドを計算します。

![ピクセルの行](https://acko.net/files/gpubox/image/pixels-row.png)

$$ O = [\infty, \infty, \infty, 0, 0, 0, 0, 0, \infty, 0, 0, 0, \infty, \infty, \infty] $$
$$ P = [3, 2, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3] $$

次に内側の距離フィールドを計算します。`I` は `O` を反転したものです。

$$ I = [0, 0, 0, \infty, \infty, \infty, \infty, \infty, 0, \infty, \infty, \infty, 0, 0, 0] $$
$$ N = [0, 0, 0, 1, 2, 3, 2, 1, 0, 1, 2, 1, 0, 0, 0] $$

最後に合成します。外側の距離フィールドから内側の距離フィールドを引きます。

$$ P - N = [3, 2, 1,-1,-2,-3,-2,-1, 1,-1,-2,-1, 1, 2, 3] $$

[tiny-sdf] の実装では、上の処理は `a` が `1` のときの処理ロジックに対応します:

```ts
// @see https://github.com/mapbox/tiny-sdf/blob/main/index.js#L85
gridOuter.fill(INF, 0, len);
gridInner.fill(0, 0, len);

for (let y = 0; y < glyphHeight; y++) {
    for (let x = 0; x < glyphWidth; x++) {
        if (a === 1) {
            // fully drawn pixels
            gridOuter[j] = 0;
            gridInner[j] = INF;
        } else {
        }
    }
}

edt(outer, 0, 0, wp, hp, wp, this.f, this.z, this.v);
edt(inner, pad, pad, w, h, wp, this.f, this.z, this.v);

for (let i = 0; i < np; i++) {
    const d = Math.sqrt(outer[i]) - Math.sqrt(inner[i]);
    out[i] = Math.max(
        0,
        Math.min(255, Math.round(255 - 255 * (d / this.radius + this.cutoff))),
    );
}
```

2D EDT の計算は、この節の冒頭で紹介したとおり、1 次元の距離二乗を 2 パスに分解し、最後に平方根を取ります。ポストプロセスのガウシアンブラーに似ています。

> フーリエ変換と同じように、各行 X に水平方向へ適用し、その後各列 Y に垂直方向へ適用する（またはその逆）ことで、2D 画像に適用できます。

ここでも、`height * width` サイズのグリッドに対する複雑度が $O(n)$ であることを直接見て取れます:

```ts
// @see https://github.com/mapbox/tiny-sdf/blob/main/index.js#L110
function edt(data, width, height, f, d, v, z) {
    // Pass 1
    for (var x = 0; x < width; x++) {
        for (var y = 0; y < height; y++) {
            f[y] = data[y * width + x];
        }
        // Fix x and calculate 1D distance squared
        edt1d(f, d, v, z, height);
        for (y = 0; y < height; y++) {
            data[y * width + x] = d[y];
        }
    }
    // Pass 2
    for (y = 0; y < height; y++) {
        for (x = 0; x < width; x++) {
            f[x] = data[y * width + x];
        }
        edt1d(f, d, v, z, width);
        for (x = 0; x < width; x++) {
            // Take the square root to get the Euclidean distance
            data[y * width + x] = Math.sqrt(d[x]);
        }
    }
}
```

単一文字の SDF 生成の問題を解決したら、次のステップはすべての文字の SDF を 1 枚の大きな画像へまとめることです。この画像は後でテクスチャとして使います。

### グリフアトラス {#glyph-atlas}

個々の SDF は、後でテクスチャとして使うために 1 枚の大きな画像へまとめる必要があり、CSS Sprite に似ています。この種の問題は [Bin packing problem] と呼ばれ、小さな箱を大きな箱へ入れ、空間を合理的に使って隙間を減らします。私たちは [potpack] を選びます。このアルゴリズムはできるだけ正方形に近い結果を得られますが、レイアウトを生成したあとは変更できず、再生成しかできないという欠点があります。

![potpack によるグリフアトラス](https://miro.medium.com/v2/resize:fit:1024/format:webp/0*YcJm5NJXJCIO20ds.png)

アトラスは、テキストのバッチが現在使っているグリフを保存します。最初のビルドには、空のテキストでも有効なメトリクスを持つように空白グリフも含めます。新しい文字が現れたり、フォントファミリー、ウェイト、スタイル、塗りが変わったりするとアトラスを再構築でき、フォントサイズだけを変える場合は再利用します。見える文字だけを生成すれば、ラベルの多い SVG を読み込むときに、テキストスタイルごとに未使用の ASCII グリフ 96 個を焼き込むことを避けられます。

このテクスチャはチャンネルを 1 つだけ使えば足ります。WebGL なら `gl.ALPHA` 形式を使えますが、WebGPU には対応する形式がありません。そのため `Format.U8_R_NORM` 形式を使います。これは WebGL では `gl.LUMINANCE`、WebGPU では [r8unorm] です。

```ts
this.glyphAtlasTexture = device.createTexture({
    ...makeTextureDescriptor2D(Format.U8_R_NORM, atlasWidth, atlasHeight, 1),
    pixelStore: {
        unpackFlipY: false,
        unpackAlignment: 1,
    },
});
```

次にシェーダーでは、`r` チャンネルから符号付き距離を取得します:

```glsl
uniform sampler2D u_SDFMap; // glyph atlas
varying vec2 v_UV;

float dist = texture2D(u_SDFMap, v_UV).r;
```

以上がフラグメントシェーダーでの描画ロジックです。頂点シェーダーへ渡す各文字の位置をどう計算するかを見てみましょう。

### クアッドの生成 {#generate-quads}

まず、各グリフをグリフデータから 2 つの三角形（「quad」と呼びます）へ変換する必要があります。頂点は 4 つです。

![テクスチャ付き三角形メッシュとしてのテキスト文字列](/glyph-quad.png)

簡略化したグリフデータ `SymbolQuad` は次のように定義されます:

```ts
// @see https://github.com/mapbox/mapbox-gl-js/blob/main/src/symbol/quads.ts#L42
export type SymbolQuad = {
    tl: Point; // The coordinates of the four vertices in local coordinates
    tr: Point;
    bl: Point;
    br: Point;
    tex: {
        x: number; // Texture coordinates
        y: number;
        w: number;
        h: number;
    };
};
```

各グリフデータは 4 つの頂点に分割し、uv と offset を 1 つの stride にまとめたうえで、頂点シェーダーでは `a_UvOffset` を通じてアクセスします:

```ts
glyphQuads.forEach((quad) => {
    charUVOffsetBuffer.push(quad.tex.x, quad.tex.y, quad.tl.x, quad.tl.y);
    charUVOffsetBuffer.push(
        quad.tex.x + quad.tex.w,
        quad.tex.y,
        quad.tr.x,
        quad.tr.y,
    );
    charUVOffsetBuffer.push(
        quad.tex.x + quad.tex.w,
        quad.tex.y + quad.tex.h,
        quad.br.x,
        quad.br.y,
    );
    charUVOffsetBuffer.push(
        quad.tex.x,
        quad.tex.y + quad.tex.h,
        quad.bl.x,
        quad.bl.y,
    );
    charPositionsBuffer.push(x, y, x, y, x, y, x, y);

    indexBuffer.push(0 + i, 2 + i, 1 + i);
    indexBuffer.push(2 + i, 0 + i, 3 + i);
    i += 4;
});
```

頂点シェーダーでは、uv をテクスチャサイズで割り、フラグメントシェーダーへ渡してグリフアトラスをサンプリングするテクスチャ座標を得ます。同時に、offset にフォントスケールを掛けてアンカーポイントからのオフセットを求め、最後に位置とオフセットを足して最終的な頂点位置を得ます:

```glsl
v_Uv = a_UvOffset.xy / u_AtlasSize;

vec2 offset = a_UvOffset.zw * fontScale;
gl_Position = vec4((u_ProjectionMatrix
    * u_ViewMatrix
    * u_ModelMatrix
    * vec3(a_Position + offset, 1)).xy, zIndex, 1);
```

最後に、グリフデータをどう計算するかを見てみましょう。前の節で段落を分割したあと、複数行の文字列配列 `lines` を得ました。これに `textAlign` `letterSpacing` `fontMetrics` を組み合わせて、各文字のアンカーポイントに対する位置情報を計算します。

```ts
function layout(
    lines: string[], // after paragraph segmentation
    fontStack: string,
    lineHeight: number,
    textAlign: CanvasTextAlign,
    letterSpacing: number,
    fontMetrics: globalThis.TextMetrics & { fontSize: number },
): PositionedGlyph[] {}
```

ここでは [mapbox-gl-js shaping.ts] の実装を参考にします:

```ts
export type PositionedGlyph = {
    glyph: number; // charCode
    x: number;
    y: number;
    scale: number; // The scale ratio calculated according to the zoom level
    fontStack: string;
};
```

```ts
lines.forEach((line) => {
    const lineStartIndex = positionedGlyphs.length;

    canvasTextMetrics.splitGraphemes(line).forEach((char) => {});
});
```

## 改善 {#improvements}

現在レンダリングしているテキストは、拡大すると明らかな「人工的な痕跡」があります。はっきりした理由の一つは、生成される SDF の解像度です。Mapbox の現在の実装では `SDF_SCALE` でこれを制御します。生成する SDF の解像度が高いほど繊細になりますが、性能も低下します。

<https://github.com/mapbox/mapbox-gl-js/blob/main/src/render/glyph_manager.ts#L34>

> SDF_SCALE の選択は、性能と品質のトレードオフです。
> グリフ生成時間はスケールに対して二次的に増える一方、品質の向上はスケールがデバイスのピクセル比を超えると急速に頭打ちになります。スケール 2 は、許容できるコストで HDPI 画面に目に見える改善をもたらします。

次の図は、`SDF_SCALE` が 1 と 4 のときに拡大した比較結果です。

|            SDF_SCALE = 1            |            SDF_SCALE = 4            |
| :---------------------------------: | :---------------------------------: |
| ![sdf スケール 1](/sdf-scale-1.png) | ![sdf スケール 4](/sdf-scale-4.png) |

ただし、まず SDF の解像度は調整しないことにします。[tiny-sdf] の現在の実装には、まだ問題があります。

### サブピクセル距離変換 {#sub-pixel-distance-transform}

[Sub-pixel Distance Transform] は [tiny-sdf] の実装に問題があることを指摘し、改善した実装を示しています。

まず、Canvas で白黒だけのハードマスクではなく、グレースケール画像を生成します。

![グレーのピクセル行](https://acko.net/files/gpubox/image/pixels-row-grey.png)

[tiny-sdf] の実装では、`a` が 1 でないとき次のように処理します:

```ts
// @see https://github.com/mapbox/tiny-sdf/blob/main/index.js#L89
if (a === 1) {
} else {
    const d = 0.5 - a; // aliased pixels
    gridOuter[j] = d > 0 ? d * d : 0;
    gridInner[j] = d < 0 ? d * d : 0;
}
```

![tiny-sdf と use.gpu の比較](https://acko.net/files/gpubox/image/glyph-xy-compare-t@2x.png)

### MSDF {#msdf}

低解像度の距離フィールドで再構成すると、文字の角が滑らかすぎて、本来の鋭さを保てません。ここでこの問題を解決します。

![sdf と msdf の比較](/msdf-vs-sdf.png)

距離フィールドには集合演算を適用できます。次の図は [Shape Decomposition for Multi-channel Distance Fields] からのもので、2 つの距離フィールドをビットマップの 2 つの成分（R と G）にそれぞれ格納します。再構成するとき、この 2 つの距離フィールドは角で滑らかですが、交差を使うと鋭く復元する効果が得られます。

![形状を 2 つの丸い形状の和集合へ分解できる一例](/msdf.png)

分解アルゴリズムは、原論文 [Shape Decomposition for Multi-channel Distance Fields] の 4.4 節 Direct multi-channel distance field construction を参照できます。実際の利用では著者が [msdfgen] を提供しており、低解像度でも MSDF の効果がはるかに良く、より高解像度の SDF よりも優れていることがわかります。

生成ツールとしては、オンラインツールの [MSDF font generator] と、CLI ツールの [msdf-bmfont-xml] があります。これらのツールは MSDF アトラスを生成すると同時に、後の描画に使う各文字のレイアウト情報を含む `fnt` または `json` ファイルも生成します。[pixi-msdf-text] は Pixi.js を使った完全な例で、[BitmapFontLoader] を使って `fnt` ファイルを読み込みます。私たちのプロジェクトもその実装を参考にしています。

フラグメントシェーダーで `median` を使って再構成するとき:

```glsl
float median(float r, float g, float b) {
  return max(min(r, g), min(max(r, g), b));
}

#ifdef USE_MSDF
    vec3 s = texture(SAMPLER_2D(u_Texture), v_Uv).rgb;
    float dist = median(s.r, s.g, s.b);
#else
```

下の例では、拡大しても文字のエッジが鋭いままであることがわかります。

<MSDFText />

### font-kerning {#font-kerning}

事前生成したビットマップフォントには `kernings` を含められ、決まった順序の 2 文字のあいだの間隔を調整できます。

たとえば <https://pixijs.com/assets/bitmap-font/desyrel.xml>

```xml
<kernings count="1816">
    <kerning first="102" second="102" amount="2" />
    <kerning first="102" second="106" amount="-2" />
</kernings>
```

バウンディングボックスの計算とレイアウトの両方で、これを考慮する必要があります。次の例はその違いを示します。

<BitmapFont />

実行時に [font-kerning] を取得したい場合は、<https://github.com/mapbox/tiny-sdf/issues/6#issuecomment-1532395796> で示されている方法を参照できます。

![font-kerning](https://developer.mozilla.org/en-US/docs/Web/CSS/font-kerning/font-kerning.png)

```ts
const unkernedWidth =
    tinySdf.ctx.measureText('A').width + tinySdf.ctx.measureText('V').width;
const kernedWidth = tinySdf.ctx.measureText('AV').width;
const kerning = kernedWidth - unkernedWidth; // a negative value indicates you should adjust the SDFs closer together by that much
```

### 絵文字 {#emoji}

[EmojiEngine] のように、一部の絵文字レンダリング実装では事前生成した絵文字アトラスを使います。しかしこの方法は、テクスチャサイズの制限があるだけでなく、プラットフォームごとに異なる絵文字の見た目を保てません。そのため SDF と同様に、現在のプラットフォームの実行時に、必要に応じて絵文字を生成したいと考えます。

この方法と SDF の最大の違いは、アルファチャンネルだけを残せないことで、その後の距離フィールド再構成のために RGB の 3 チャンネルをすべて保持する必要がある点です。

<Emoji />

## SVG の書き出し {#export-svg}

複数行テキストを SVG へ書き出すときは `<tspan>` を使え、`dy` を計測後の行の高さに設定します:

```html
<text
    x="0"
    y="0"
    dominant-baseline="ideographic"
    id="node-text-5"
    font-family="Gaegu"
    font-size="16"
    fill="black"
    transform="matrix(1,0,0,1,50,234)"
>
    <tspan x="0" dy="17.368">Abcdef</tspan>
    <tspan x="0" dy="17.368">ghijklm</tspan>
    <tspan x="0" dy="17.368">nop(ide</tspan>
</text>
```

## さらに読む {#extended-reading}

-   [State of Text Rendering 2024]
-   [Signed Distance Field Fonts - basics]
-   [Approaches to robust realtime text rendering in threejs (and WebGL in general)]
-   [Easy Scalable Text Rendering on the GPU]
-   [Text Visualization Browser]
-   [Rive Text Overview]
-   [Texture-less Text Rendering]
-   [Text layout is a loose hierarchy of segmentation]
-   [End-To-End Tour of Text Layout/Rendering]
-   [Text rendering in mapbox]
-   [Rendering Crispy Text On The GPU]
-   [Localization, languages, and listening]
-   [RTL languages in Figma]

[Drawing text]: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Drawing_text
[FreeType]: https://freetype.org/
[freetype-gl]: https://github.com/rougier/freetype-gl
[Easy Scalable Text Rendering on the GPU]: https://medium.com/@evanwallace/easy-scalable-text-rendering-on-the-gpu-c3f4d782c5ac
[use-gpu-text]: https://gitlab.com/unconed/use.gpu/-/tree/master/rust/use-gpu-text
[Text Visualization Browser]: https://textvis.lnu.se
[State of Text Rendering 2024]: https://behdad.org/text2024/
[Rive Text Overview]: https://rive.app/community/doc/text-overview/docSfhykWoWu
[Texture-less Text Rendering]: https://poniesandlight.co.uk/reflect/debug_print_text/
[Text layout is a loose hierarchy of segmentation]: https://raphlinus.github.io/text/2020/10/26/text-layout.html
[End-To-End Tour of Text Layout/Rendering]: https://litherum.blogspot.com/2015/02/end-to-end-tour-of-text-rendering.html
[Text rendering in mapbox]: https://github.com/mapbox/mapbox-gl-native/wiki/Text-Rendering
[HarfBuzz]: https://harfbuzz.github.io/what-is-harfbuzz.html
[harfbuzzjs]: https://github.com/harfbuzz/harfbuzzjs
[EmojiEngine]: https://github.com/trishume/EmojiEngine
[What HarfBuzz doesn't do]: https://harfbuzz.github.io/what-harfbuzz-doesnt-do.html
[Modern text rendering with Linux: Overview]: https://mrandri19.github.io/2019/07/24/modern-text-rendering-linux-overview.html
[Beautifying map labels with better line breaking]: https://blog.mapbox.com/beautifying-map-labels-with-better-line-breaking-2a6ce3ed432
[Improving Arabic and Hebrew text in map labels]: https://blog.mapbox.com/improving-arabic-and-hebrew-text-in-map-labels-fd184cf5ebd1
[mapbox-gl-js shaping.ts]: https://github.com/mapbox/mapbox-gl-js/blob/main/src/symbol/shaping.ts
[Drawing Text with Signed Distance Fields in Mapbox GL]: https://blog.mapbox.com/drawing-text-with-signed-distance-fields-in-mapbox-gl-b0933af6f817
[font hinting]: http://en.wikipedia.org/wiki/Font_hinting
[potpack]: https://github.com/mapbox/potpack
[BiDi]: https://en.wikipedia.org/wiki/Bidirectional_text
[bidi-js]: https://github.com/lojjic/bidi-js
[mapbox-gl-rtl-text]: https://github.com/mapbox/mapbox-gl-rtl-text
[Approaches to robust realtime text rendering in threejs (and WebGL in general)]: https://github.com/harfbuzz/harfbuzzjs/discussions/30
[TextMetrics]: https://developer.mozilla.org/en-US/docs/Web/API/TextMetrics
[Differences between width and actualBoundingBoxLeft(Right)]: https://stackoverflow.com/a/66846914/4639324
[Meaning of top, ascent, baseline, descent, bottom, and leading in Android's FontMetrics]: https://stackoverflow.com/questions/27631736/meaning-of-top-ascent-baseline-descent-bottom-and-leading-in-androids-font
[node-fontnik]: https://github.com/mapbox/node-fontnik
[opentype.js]: https://github.com/opentypejs/opentype.js
[msdfgen]: https://github.com/Chlumsky/msdfgen
[msdf-atlas-gen]: https://github.com/Chlumsky/msdf-atlas-gen?tab=readme-ov-file#atlas-types
[measureText]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/measureText
[text-baseline]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline
[text-align]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textAlign
[PIXI.TextMetrics]: https://api.pixijs.io/@pixi/text/PIXI/TextMetrics.html
[letterSpacing]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/letterSpacing
[grapheme-splitter]: https://github.com/orling/grapheme-splitter
[BundlePhobia grapheme-splitter]: https://bundlephobia.com/package/grapheme-splitter@1.0.4
[CanvasKit Text Shaping]: https://skia.org/docs/user/modules/quickstart/#text-shaping
[pixi-cjk]: https://github.com/huang-yuwei/pixi-cjk
[Line breaking rules in East Asian languages]: https://en.wikipedia.org/wiki/Line_breaking_rules_in_East_Asian_languages
[clusters]: https://harfbuzz.github.io/clusters.html
[Intl.Segmenter]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter
[Improved Alpha-Tested Magnification for Vector Textures and Special Effects]: https://steamcdn-a.akamaihd.net/apps/valve/2007/SIGGRAPH2007_AlphaTestedMagnification.pdf
[Signed Distance Field Fonts - basics]: https://www.redblobgames.com/x/2403-distance-field-fonts/
[Bin packing problem]: https://en.wikipedia.org/wiki/Bin_packing_problem
[msdf-bmfont-xml]: https://github.com/soimy/msdf-bmfont-xml
[pixi-msdf-text]: https://github.com/soimy/pixi-msdf-text
[Distance field fonts]: https://libgdx.com/wiki/graphics/2d/fonts/distance-field-fonts
[Distance Transforms of Sampled Functions]: https://cs.brown.edu/people/pfelzens/papers/dt-final.pdf
[tiny-sdf]: https://github.com/mapbox/tiny-sdf
[r8unorm]: https://gpuweb.github.io/gpuweb/#dom-gputextureformat-r8unorm
[Shape Decomposition for Multi-channel Distance Fields]: https://dspace.cvut.cz/bitstream/handle/10467/62770/F8-DP-2015-Chlumsky-Viktor-thesis.pdf
[Sub-pixel Distance Transform]: https://acko.net/blog/subpixel-distance-transform
[getImageData]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/getImageData
[BitmapFontLoader]: https://api.pixijs.io/@pixi/text-bitmap/PIXI/BitmapFontLoader.html
[MSDF font generator]: https://msdf-bmfont.donmccurdy.com/
[font-kerning]: https://developer.mozilla.org/en-US/docs/Web/CSS/font-kerning
[BiDi in Pixi.js]: https://github.com/pixijs/pixijs/issues/4482
[Rendering Crispy Text On The GPU]: https://osor.io/text
[Localization, languages, and listening]: https://www.figma.com/blog/expanding-figmas-international-presence/
[RTL languages in Figma]: https://help.figma.com/hc/en-us/articles/4972283635863-Add-right-to-left-text
[International Components for Unicode (ICU)]: http://site.icu-project.org/
[rtl-text]: https://www.jsdelivr.com/package/npm/rtl-text
[JavaScript-Arabic-Reshaper]: https://github.com/louy/JavaScript-Arabic-Reshaper
[text-overflow]: https://developer.mozilla.org/en-US/docs/Web/CSS/text-overflow
[CanvasTextMetrics]: https://github.com/pixijs/pixijs/blob/dev/src/scene/text/canvas/CanvasTextMetrics.ts#L369
