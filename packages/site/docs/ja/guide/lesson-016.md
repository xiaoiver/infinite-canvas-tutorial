---
outline: deep
description: 'ベジェ曲線による描画、テキストのストローク、装飾、シャドウ、パス上のテキスト、選択とアクセシビリティに対応した対話的なテキスト編集など、高度なテキスト機能を見ていきます。'
head:
    - [
          'meta',
          { property: 'og:title', content: '第16課 - テキストの高度な機能' },
      ]
---

<script setup>
import WebFontLoader from '../../components/WebFontLoader.vue';
import Opentype from '../../components/Opentype.vue';
import Harfbuzz from '../../components/Harfbuzz.vue';
import TeXMath from '../../components/TeXMath.vue';
import TextDropShadow from '../../components/TextDropShadow.vue';
import TextStroke from '../../components/TextStroke.vue';
import TextDecoration from '../../components/TextDecoration.vue';
import TextPath from '../../components/TextPath.vue';
import PhysicalText from '../../components/PhysicalText.vue';
import TextEditor from '../../components/TextEditor.vue';
</script>

# 第 16 課 - テキストの高度な機能 {#lesson-16-text-advanced-features}

前の課では、SDF に基づくテキストレンダリングの原理を紹介し、ESDT と MSDF で描画品質を高める実験を行い、CanvasKit が Canvas と比べて提供する高度なテキスト描画機能にも触れました。

この課では、まず SDF 以外の描画方法を見たあと、装飾線、シャドウ、パスに沿うテキストといった機能を検討し、実装してみます。最後に、テキストは描けるだけでは足りず、操作もしやすくなければなりません。入力欄、テキスト選択、アクセシビリティ（A11y）を扱います。

まず、SDF 以外にどのようなテキスト描画方法があるか見ていきます。

## ベジェ曲線でテキストを描画する {#render-text-with-bezier-curve}

Figma の SVG 書き出しを見ると、テキストも Path で描かれています。描画性能と CJK 文字を考慮しないなら、ベジェ曲線でテキストを描くのはよい選択です。ブラウザ環境で文字のベクトル情報を得るには、次を使えます。

-   [opentype.js]
-   use-gpu は [ab-glyph](https://github.com/alexheretic/ab-glyph) を基に包んだ [use-gpu-text] を使います
-   ますます多くのアプリケーションが [harfbuzzjs] を使っています。[State of Text Rendering 2024] を参照してください。たとえば [font-mesh-pipeline] は簡単なデモです

以下では opentype.js と harfbuzzjs でテキストを描画する例を示します。どちらも `ttf` フォント形式に対応しています。

### opentype.js {#opentypejs}

opentype.js は `getPath` メソッドを提供します。テキスト内容、位置、フォントサイズを与えると、Shaping を終えて SVG の [path-commands] を得ます。

```ts
opentype.load('fonts/Roboto-Black.ttf', function (err, font) {
    const path = font.getPath('Hello, World!', 0, 0, 32); // x, y, fontSize
    // convert to svg path definition
});
```

<Opentype />

### harfbuzzjs {#harfbuzzjs}

まず Vite の ?init 構文で harfbuzzjs の WASM を初期化します。それからフォントファイルを読み込み、font オブジェクトを作ります。

```ts
import init from 'harfbuzzjs/hb.wasm?init';
import hbjs from 'harfbuzzjs/hbjs.js';

const instance = await init();
hb = hbjs(instance);

const data = await (
    await window.fetch('/fonts/NotoSans-Regular.ttf')
).arrayBuffer();
blob = hb.createBlob(data);
face = hb.createFace(blob, 0);
font = hb.createFont(face);
font.setScale(32, 32); // Set font size
```

続いて buffer オブジェクトを作り、テキスト内容を追加します。以前述べたように harfbuzz は BiDi を扱わないので、テキストの方向を手動で設定する必要があります。最後に hb.shape メソッドを呼び出して Shaping の計算を行います。

```ts
buffer = hb.createBuffer();
buffer.addText('Hello, world!');
buffer.guessSegmentProperties();
// TODO: use BiDi
// buffer.setDirection(segment.direction);

hb.shape(font, buffer);
const result = buffer.json(font);
```

これでグリフデータが得られたので、Path で描画できます。

```ts
result.forEach(function (x) {
    const d = font.glyphToPath(x.g);
    const path = new Path({
        d,
        fill: '#F67676',
    });
});
```

<Harfbuzz />

### TeX 数式のレンダリング {#tex-math-rendering}

[MathJax] で TeX の数式をレンダリングし、SVG に変換してから Path で描画できます。ここでは [LaTeX in motion-canvas] の方法に従って SVGElement を取得します。

```ts
const JaxDocument = mathjax.document('', {
    InputJax: new TeX({ packages: AllPackages }),
    OutputJax: new SVG({ fontCache: 'local' }),
});

const svg = Adaptor.innerHTML(JaxDocument.convert(formula));
const parser = new DOMParser();
const doc = parser.parseFromString(svg, 'image/svg+xml');
const $svg = doc.documentElement;
```

それから [第 10 課 - SVGElement からシリアライズされたノードへ] で紹介した方法を使い、SVGElement を図形に変換してキャンバスに追加します。

```ts
const root = await deserializeNode(fromSVGElement($svg));
```

<TeXMath />

## テキストのストローク {#text-stroke}

Canvas の [strokeText] と CSS の [-webkit-text-stroke] は、どちらもテキストのストロークを提供します。幸い、ストロークは SDF では自然に実装しやすいものです。

```glsl
if (strokeWidth > 0.0 && strokeColor.a > 0.0) {
    float fillAlpha = smoothstep(buff - gamma_scaled, buff + gamma_scaled, dist);
    float strokeThreshold = buff - strokeWidth / fontSize;
    float strokeAlpha = smoothstep(strokeThreshold - gamma_scaled, strokeThreshold + gamma_scaled, dist);

    vec4 finalColor = mix(strokeColor, fillColor, fillAlpha);
    outputColor = finalColor;
    opacity *= strokeAlpha;
}
```

以下は SDF と MSDF に基づく描画結果です。MSDF はストロークを付けてもシャープなままです。

<TextStroke />

## テキスト装飾 {#text-decoration}

CSS では、初期のブラウザによる [text-decoration] の実装は粗いものでした。`underline` がその例で、次の画像は [Crafting link underlines on Medium] から取ったものです。

![醜く、目障りで、許容できない下線](https://miro.medium.com/v2/resize:fit:2000/format:webp/1*RmN57MMY_q9-kEt7j7eiVA.gif)

> 完璧な下線は見えますが、主張しすぎません。何がクリックできるかは分かるようにしつつ、下線そのものに注意を引きすぎてはいけません。テキストからちょうどよい距離に置き、ディセンダーが同じ場所を占めようとするときには、その背後に収まるようにします。

![美しい下線](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*5iD2Znv03I2XR5QI3KLJrg.png)

現在のブラウザはこの実装を完成させています。一方 Canvas はこの機能を提供せず、CanvasKit は CSS の `text-decoration` に対応する一連のプロパティでこれを強化しています。

```ts
// @see https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration#constituent_properties
// @see https://skia.org/docs/dev/design/text_shaper/#principles
const paraStyle = new CanvasKit.ParagraphStyle({
    textStyle: {
        decoration: CanvasKit.UnderlineDecoration,
        decorationColor,
        decorationThickness,
        decorationStyle: CanvasKit.DecorationStyle.Solid,
    },
});
```

もう一つの興味深い実装 [underlineJS] は Canvas に基づいています。

### ポリラインを使う {#use-polyline}

装飾線のスタイルは `decorationStyle` プロパティで制御します。

```ts
export type TextDecorationStyle =
  | 'solid'
  | 'double'
  | 'dotted'
  | 'dashed'
  | 'wavy';
: TextDecorationStyle;
```

最も単純な `solid` スタイルでは、`decorationColor` と `decorationThickness` を `strokeColor` と `strokeWidth` として渡します。

```ts
if (instance instanceof Text) {
    const {
        decorationColorRGB,
        decorationThickness,
        decorationStyle,
        metrics,
    } = instance;
    u_StrokeColor = [
        decorationColorRGB.r / 255,
        decorationColorRGB.g / 255,
        decorationColorRGB.b / 255,
        fo,
    ];
    u_ZIndexStrokeWidth[1] = decorationThickness;
}
```

### 装飾スタイル {#decoration-style}

ポリライン自体が `strokeDasharray` に対応しているので、`dotted` と `dashed` はどちらもそれで実現できます。ここでは Skia の実装を参考に、`dash` と `gap` の比率を決めます。

```c++
// @see https://github.com/google/skia/blob/main/modules/skparagraph/src/Decorations.cpp#L187
SkScalar scaleFactor = textStyle.getFontSize() / 14.f;
switch (textStyle.getDecorationStyle()) {
    case TextDecorationStyle::kDotted: {
        dashPathEffect.emplace(1.0f * scaleFactor, 1.5f * scaleFactor);
        break;
    }
    case TextDecorationStyle::kDashed: {
        dashPathEffect.emplace(4.0f * scaleFactor, 2.0f * scaleFactor);
        break;
    }
    default: break;
}
```

`wavy` は具体的に計算してサンプリングする必要があります。ここでは SVG Path を生成し、[第 13 課 - 曲線上のサンプリング] で説明した方法を使います。

```c++
// @see https://github.com/google/skia/blob/main/modules/skparagraph/src/Decorations.cpp#L215
let d = 'M 0 0';
while (x_start + quarterWave * 2 < line.width) {
    d += ` Q ${x_start + quarterWave} ${
        wave_count % 2 != 0 ? quarterWave : -quarterWave
    } ${x_start + quarterWave * 2} 0`;

    x_start += quarterWave * 2;
    ++wave_count;
}
```

効果は次のとおりです。

<TextDecoration />

### 位置の計算 {#calculate-position}

位置は `decorationLine` プロパティで制御します。

```ts
export type TextDecorationLine =
    | 'underline'
    | 'overline'
    | 'line-through'
    | 'none';
```

Skia の [Decorations::calculatePosition] 実装を参考にし、`underline` を例にします。

```c++
void Decorations::calculatePosition(TextDecoration decoration, SkScalar ascent) {
    switch (decoration) {
        case TextDecoration::kUnderline:
            if ((fFontMetrics.fFlags & SkFontMetrics::FontMetricsFlags::kUnderlinePositionIsValid_Flag) &&
                fFontMetrics.fUnderlinePosition > 0) {
                fPosition  = fFontMetrics.fUnderlinePosition;
            } else {
                fPosition = fThickness;
            }
            fPosition -= ascent;
            break;
    }
}
```

### SVG の書き出し {#export-svg-text-decoration}

残念ながら現時点（2025.7.9）では、SVG は [text-decoration] を完全にはサポートしていません。下の右側では text-decoration-color が指定した青を尊重せず、テキスト色で上書きされ、text-decoration-style はまったくサポートされていません。[Text decoration of a text svg in html] を参照してください。

> どうやら text-decoration-color は SVG の text 要素には適用されないようです

Figma は `<path>` として書き出すことでこれを回避しています。私たちは `<text>` を残したいので、SVG を書き出すときは `<foreignObject>` のラッパーしか使えません。下の左側を参照してください。

```html
<foreignObject width="50" height="20">
    <span style="text-decoration: underline; text-decoration-color: blue;">
        Text
    </span>
</foreignObject>
```

<svg viewBox="0 0 100 20">
  <foreignObject width="50" height="20">
    <span style="text-decoration: underline; text-decoration-color: blue;">
      Text
    </span>
  </foreignObject>
  <text x="50" y="17" style="text-decoration: underline; text-decoration-color: blue;"  >
    Text
  </text>
</svg>

## シャドウ {#dropshadow}

Pixi.js は [DropShadowFilter] を提供しますが、ポストプロセスを使わず SDF の中で直接実装できます。`shadowOffset` と `shadowBlurRadius` で SDF テクスチャのオフセットとぼかしを制御します。

```glsl
// @see https://github.com/soimy/pixi-msdf-text/blob/master/src/msdf.frag#L49
vec3 shadowSample = texture2D(uSampler, vTextureCoord - shadowOffset).rgb;
float shadowDist = median(shadowSample.r, shadowSample.g, shadowSample.b);
float distAlpha = smoothstep(0.5 - shadowSmoothing, 0.5 + shadowSmoothing, shadowDist);
vec4 shadow = vec4(shadowColor, shadowAlpha * distAlpha);
gl_FragColor = mix(shadow, text, text.a);
```

<TextDropShadow />

## パスに沿ったテキスト {#text-along-path}

Figma コミュニティでは、多くのユーザーがこの機能を待ち望んでいました。たとえば [Make text follow a path or a circle] です。最近、公式にサポートされました。[Type text on a path] を参照してください。

![パス上にテキストを入力](https://help.figma.com/hc/article_attachments/31937313416471)

SVG では [textPath] で実現できます。[Curved Text Along a Path] を参照してください。

```html
<path
    id="curve"
    d="M73.2,148.6c4-6.1,65.5-96.8,178.6-95.6c111.3,1.2,170.8,90.3,175.1,97"
/>
<text width="500">
    <textPath xlink:href="#curve"> Dangerous Curves Ahead </textPath>
</text>
```

Skia は `MakeOnPath` メソッドを提供します。[Draw text along a path] を参照してください。

```ts
const textblob = CanvasKit.TextBlob.MakeOnPath(text, skPath, skFont);
canvas.drawTextBlob(textblob, 0, 0, textPaint);
```

Mapbox では、道路や川に沿ってラベルを置くのが一般的な場面です。[Map Label Placement in Mapbox GL] を参照してください。

![Mapbox GL の地図ラベル配置](https://miro.medium.com/v2/resize:fit:480/format:webp/0*qVAASwC-tjIXnjax.gif)

Kittl は [Easily Type Text On Any Path] ツールを提供しています。

別の実装については [fabricjs - text on path] を参照してください。各グリフはアドバンスボックスの中心における **弧長** で配置し、同じ距離の接線で向きを決めます。ベジェのパラメータ `t` は、一般に長さの割合ではありません。点と接線のサンプリングは、[第 13 課 - 曲線上のサンプリング] で説明されているとおり、同じ弧長の対応を使わなければなりません。

```ts
const centerDistance =
    startOffset + alignmentOffset + advanceBefore + advance / 2;
const ratio = centerDistance / totalPathLength;
const point = curve.getPointAt(ratio);
const tangent = curve.getTangentAt(ratio);
```

アドバンス幅が次のグリフの位置を決めます。これはテクスチャ幅、インクベアリング、SDF のパディングとは異なります。`letterSpacing` は隣接するグリフの間にだけ適用されます。

### 回転の調整 {#adjust-rotation}

実装では CPU 上で各 Quad を **グリフのベースライン原点** を中心に回転してから、SDF/MSDF で描画します。テクスチャの下端を中心に回転すると、フォントとサイズごとにテキストのずれ方が変わります。

```ts
const rotation = Math.atan2(tangent[1], tangent[0]);
const x =
    point[0] -
    (Math.cos(rotation) * advance) / 2 -
    Math.sin(rotation) * pathOffset;
const y =
    point[1] -
    (Math.sin(rotation) * advance) / 2 +
    Math.cos(rotation) * pathOffset;
```

この例は `alphabetic` ベースラインを使います。他の `textBaseline` の調整も局所法線に従います。バウンディングボックスは回転したグリフのインク矩形の和集合なので、内容、サイズ、パス、オフセットを変えると選択範囲のバウンディングボックスも更新されます。

| 属性            | 動作                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------- |
| `textAlign`     | 利用できるパス長を基準に `start` / `left`、`center`、`end` / `right`                                |
| `startOffset`   | 揃えたテキストを読み方向に沿って、ドキュメント単位で動かします                                      |
| `side`          | `left` はパスに沿います。`right` は反対側の端から進み、読み順を保ったままグリフを回転します         |
| `pathOffset`    | ベースラインを局所法線に沿って動かします。正の値は、読み方向の接線から時計回りに 90° の側にあります |
| `letterSpacing` | 隣接するグリフの間に距離を加えます                                                                  |

開いたパスでは、中心がどちらかの端点を越えるグリフは省略します。折り返したり、端点に積み重ねたりはしません。一つの閉じた輪郭は、正または負のオフセットで継ぎ目をまたぐことができ、1 行につき最大一周です。別々のサブパスは長さを連結しますが、`M` の隙間を横切る線は作りません。追加の行は行高の間隔で局所法線に沿います。

テキストまたは青いハンドルをパスに沿ってドラッグし、オレンジの制御点をドラッグして曲線の形を変えられます。曲線、円、直線を切り替え、側面と配置を変え、間隔とベースライン距離を調整できます。ハンドルは矢印キーに対応し、Shift で大きく動き、Esc でキャンセルします。キャンセルされたタッチジェスチャは開始時の状態に戻します。

<TextPath />

この例は `core` の SDF テキストレンダラーを使います。パスのレイアウトと編集の改善は既存のグラフェム処理を維持し、完全な OpenType シェーピングや合字の対応は追加していません。

ECS もこれらのパス属性に対応し、トランスフォーマーのジェスチャ、グリフのピッキング、元に戻す/やり直す、テキスト編集を備えています。[ECS のパステキスト例](/example/text-path#ecs-editor) を試してください。編集中は直線のテキストボックスを使い、確定すると曲線のレイアウトに戻ります。

### SVG の書き出し {#export-svg-text-path}

ネイティブ SVG は下の例のように [textPath] に対応しています。[Curved Text Along a Path] を参照してください。エクスポーターはキャンバスのレイアウトを共有し、位置を指定した `<tspan>` 要素に `x`、`y`、`rotate` を付けて出力します。`textPath side` の対応がブラウザごとに違っても、側面の変更、はみ出しのクリップ、閉じた継ぎ目を保つためです。JSON シリアライズはパス、側面、配置、オフセットを残すので、読み込んだあとさらに編集できます。

```html
<path
    id="MyPath"
    fill="none"
    stroke="red"
    d="M10,90 Q90,90 90,45 Q90,10 50,10 Q10,10 10,40 Q10,70 45,70 Q70,70 75,50"
></path>
<text>
    <textPath href="#MyPath">Quick brown fox jumps over the lazy dog.</textPath>
</text>
```

<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <!-- パスを隠すには、通常 <defs> 要素で囲みます -->
  <!-- <defs> -->
  <path id="MyPath" fill="none" stroke="red" d="M10,90 Q90,90 90,45 Q90,10 50,10 Q10,10 10,40 Q10,70 45,70 Q70,70 75,50"></path>
  <!-- </defs> -->

  <text>
    <textPath href="#MyPath">Quick brown fox jumps over the lazy dog.</textPath>
  </text>
</svg>

## より使いやすい操作 {#more-friendly-interaction}

ブラウザネイティブの `<textarea>` は、点滅するカーソル、選択範囲、キーボード操作、コピーと貼り付けなどの便利な機能を提供します。`<canvas>` を基にこれらの機能を一から実装するのは非常に手間のかかる作業です。たとえば [fabricjs - loading custom fonts] や Google Docs があります。そのため、この方法は選びません。

<TextEditor />

### テキスト入力 {#textarea}

下の Figma の画面では、ネイティブの `<textarea>` 要素がキャンバス上に自分を配置し、Text をダブルクリックすると入力欄が表示されます。

![Figma の textarea](/textarea-in-figma.png)

excalidraw でもこの方式を使っています。[textWysiwyg.tsx] を参照してください。

![excalidraw のテキストエディタ](/excalidraw-text-editor.png)

私たちも `<ic-text-editor>` 要素を追加し、キャンバスの Text レンダリングにできるだけ合わせます。ネイティブの `<textarea>` 要素はスタイルをリセットします。たとえば枠線と背景を表示しません。`fontFamily`、`fontSize`、`color` プロパティには対応する CSS プロパティがあり、直接設定できます。ただし絶対配置を使うときは、いくつかの要因を考慮する必要があります。

```ts
@customElement('ic-text-editor')
export class TextEditor extends LitElement {
    static styles = css`
        :host {
            position: absolute;
        }
        textarea {
            position: absolute;
            display: none;
            margin: 0;
            padding: 0;
            border: 0;
            outline: 0;
            resize: none;
            background: transparent;
        }
    `;

    @query('textarea')
    editable: HTMLTextAreaElement;

    render() {
        return html`<textarea></textarea>`;
    }
}
```

まず、ダブルクリックしたマウスイベントの位置座標をビューポート座標系に変換する必要があります。

```ts
const { x, y } = this.api.canvas2Viewport({
    x: this.node.x,
    y: this.node.y,
});

this.editable.style.left = `${x}px`;
this.editable.style.top = `${y}px`;
```

次に、カメラの現在のズームレベルを考慮する必要があります。

```ts
const { zoom } = this.api.getCamera().read(ComputedCamera);
this.editable.style.transform = `scale(${zoom})`;
this.editable.style.transformOrigin = `left top`;
```

最後に、`<textarea>` 要素上のスクロールがブラウザの既定の動作を起こさず、その要素を通り抜けて `<canvas>` 要素上で起き、カメラのパンとズームを行うようにします。

```ts
handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const newWheelEvent = new WheelEvent('wheel', {});
    $canvas.dispatchEvent(newWheelEvent);
};
```

効果は次のとおりです。

![カメラによるパンとズーム](/text-editor-with-camera.gif)

### テキスト変更時のサイズ計算 {#calculate-size}

入力中やテキストの貼り付け時には、`<textarea>` の幅と高さをリアルタイムで計算し直して設定する必要があります。

### Tab の処理 {#in-and-outdent}

`<textarea>` で Tab キーを押したときの既定の動作は、フォーカスを次の要素へ移すことです。コードエディタと同じにしたいと考えています。

[excalidraw - handle tab]

### テキスト選択 {#text-selection}

Text の上に textarea を重ねる機能をサポートすれば、この機能は簡単に実装できます。

## 特殊効果 {#special-effects}

### Web フォントの読み込み {#load-web-font}

Canvas2D API で SDF を生成する方式では、[webfontloader] で先にフォントを読み込み、`fontFamily` でフォントを指定するだけで済みます。

```ts
import WebFont from 'webfontloader';
WebFont.load({
    google: {
        families: ['Gaegu'], // specify font
    },
    active: () => {
        const text = new Text({
            x: 150,
            y: 150,
            content: 'Hello, world',
            fontFamily: 'Gaegu', // specify font
            fontSize: 55,
            fill: '#F67676',
        });
    },
});
```

<WebFontLoader />

ホームページの例で Text モードに切り替え、`Gaegu` というカスタムフォントを選ぶこともできます。

![テキストペンの WebFont](/webfont-in-text-pen.png)

### Material Design on the GPU {#material-design-on-the-gpu}

[Material Design on the GPU] は、SDF テキストに基づくマテリアル効果を紹介しています。ノーマルマップとライティングを使い、紙の上にインクがにじむ様子をシミュレートします。ライティングは考慮せず、simplex noise だけで実装し、複数の吸収効果を加えます。

```js
import { simplex_2d } from './simplex-2d';
import { aastep } from './aastep';
export const absorb = /* wgsl */ `
  ${aastep}
  ${simplex_2d}
  float absorb(float sdf, vec2 uv, float scale, float falloff) {
    float distort = sdf + snoise(uv * scale) * falloff;
    return aastep(0.5, distort);
  }
`;
```

<PhysicalText />

## さらに読む {#extended-reading}

-   [Material Design on the GPU]
-   [Make text follow a path or a circle]
-   [Curved Text Along a Path]
-   [Draw text along a path]
-   [textPath]
-   [Map Label Placement in Mapbox GL]

[Material Design on the GPU]: https://mattdesl.svbtle.com/material-design-on-the-gpu
[Make text follow a path or a circle]: https://forum.figma.com/t/make-text-follow-a-path-or-a-circle/23476/34
[Curved Text Along a Path]: https://css-tricks.com/snippets/svg/curved-text-along-path/
[Draw text along a path]: https://fiddle.skia.org/c/@Canvas_drawTextRSXform
[textPath]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/textPath
[Map Label Placement in Mapbox GL]: https://blog.mapbox.com/map-label-placement-in-mapbox-gl-c6f843a7caaa
[font-mesh-pipeline]: https://github.com/beanandbean/font-mesh-pipeline
[opentype.js]: https://github.com/opentypejs/opentype.js
[use-gpu-text]: https://gitlab.com/unconed/use.gpu/-/tree/master/rust/use-gpu-text
[harfbuzzjs]: https://github.com/harfbuzz/harfbuzzjs
[State of Text Rendering 2024]: https://behdad.org/text2024/
[webfontloader]: https://github.com/typekit/webfontloader
[DropShadowFilter]: https://pixijs.io/filters/docs/DropShadowFilter.html
[MathJax]: https://github.com/mathjax/MathJax-src
[LaTeX in motion-canvas]: https://github.com/motion-canvas/motion-canvas/issues/190
[第 10 課 - SVGElement からシリアライズされたノードへ]: /ja/guide/lesson-010#svgelement-to-serialized-node
[path-commands]: https://github.com/opentypejs/opentype.js?tab=readme-ov-file#path-commands
[text-decoration]: https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration
[Easily Type Text On Any Path]: https://www.kittl.com/article/easily-type-text-on-any-path
[textWysiwyg.tsx]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/wysiwyg/textWysiwyg.tsx
[fabricjs - text on path]: https://fabricjs.com/demos/text-on-path/
[fabricjs - loading custom fonts]: https://fabricjs.com/demos/loading-custom-fonts/
[excalidraw - handle tab]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/wysiwyg/textWysiwyg.tsx#L412-L429
[underlineJS]: https://github.com/wentin/underlineJS
[Crafting link underlines on Medium]: https://medium.design/crafting-link-underlines-on-medium-7c03a9274f9
[-webkit-text-stroke]: https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-text-stroke
[strokeText]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/strokeText
[Decorations::calculatePosition]: https://github.com/google/skia/blob/main/modules/skparagraph/src/Decorations.cpp#L161-L185
[第 13 課 - 曲線上のサンプリング]: /ja/guide/lesson-013#sample-on-curve
[Text decoration of a text svg in html]: https://stackoverflow.com/questions/76894327/text-decoration-of-a-text-svg-in-html
[Type text on a path]: https://help.figma.com/hc/en-us/articles/360039956434-Guide-to-text-in-Figma-Design#h_01JTH0B6GEA7AVVXVS72X7ANHK
