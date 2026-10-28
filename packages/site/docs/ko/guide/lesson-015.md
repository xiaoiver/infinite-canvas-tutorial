---
outline: deep
description: 'TextMetrics, HarfBuzz를 이용한 셰이핑, 텍스트 분할, BiDi 지원, SDF 아틀라스 생성, 국제 타이포그래피를 위한 이모지 처리를 포함한 복잡한 텍스트 렌더링을 익힙니다.'
head:
    - ['meta', { property: 'og:title', content: '15강 - 텍스트 렌더링' }]
---

<script setup>
import MSDFText from '../../components/MSDFText.vue';
import BitmapFont from '../../components/BitmapFont.vue';
import Emoji from '../../components/Emoji.vue';
import Bidi from '../../components/Bidi.vue';
import TextBaseline2 from '../../components/TextBaseline2.vue';
</script>

# 15강 - 텍스트 렌더링 {#lesson-15-text-rendering}

텍스트 렌더링은 매우 복잡한 과정입니다. [State of Text Rendering 2024]가 이를 아주 자세히 소개하므로, 읽어 보기를 권합니다.

이번 강의에서는 다음 내용을 학습합니다.

-   TextMetrics란 무엇이며, 서버와 브라우저에서 어떻게 얻는지
-   셰이핑(Shaping)이란 무엇인가
-   텍스트 분할과 자동 줄바꿈, BiDi, 복합 문자
-   SDF 아틀라스를 생성하고 그리기에 사용하는 방법
-   이모지를 처리하는 방법

브라우저가 제공하는 Canvas 2D의 [Drawing text]나 SVG에 익숙한 개발자에게는, 텍스트 렌더링의 복잡도가 상상 이상일 수 있습니다. 아래 그림은 [Modern text rendering with Linux: Overview]에서 가져온 것으로, 텍스트에서 글리프, 래스터화, 그리고 최종적으로 화면에 그리는 단계까지의 데이터 흐름을 보여 줍니다. [HarfBuzz], [FreeType], Bidi, 그리고 현재 가장 널리 쓰이는 글꼴 형식인 OpenType은 뒤에서 간단히 소개합니다. 흥미롭게도 HarfBuzz는 "open type"을 뜻하는 페르시아어 이름입니다.

![텍스트 렌더링의 데이터 흐름](https://mrandri19.github.io/assets/images/modern-text-rendering-linux-overview/overview.svg)

웹 기반 시각화 프로젝트에서의 이전 경험에 비추어 보면, [Text rendering in mapbox]가 더 실용적인 참고가 됩니다. 앞에서 말한 처리 사슬의 도구 대부분을 직접 다루지는 않기 때문입니다. 그래도 과정을 가능한 한 많이 이해해 두면 텍스트 렌더링의 본질을 파악하는 데 도움이 됩니다.

## 셰이핑 {#shaping}

입력부터 살펴보겠습니다. 한 조각의 텍스트와 글꼴이 주어지며, 글꼴은 `fontstack` 형태로 제공되므로 배열입니다:

```json
{
    "text-field": "Hey",
    "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"]
}
```

::: info fontstack
fontstack은 기본 글꼴과 선택적인 대체 글꼴로 이루어진 순서 있는 목록입니다.
<https://docs.mapbox.com/help/troubleshooting/manage-fontstacks/>
:::

셰이핑이란 무엇일까요? 아래 그림은 [Text rendering in mapbox]에서 가져온 것으로, 한 줄로 요약하면 각 문자의 위치를 순서대로 배치하는 일입니다. 물론 줄바꿈을 만나는 경우처럼 여러 상황을 고려합니다.

![셰이핑](https://cloud.githubusercontent.com/assets/375121/22094138/068c663a-ddc0-11e6-8b70-3866cb8af02a.gif)

다음 그림은 [Modern text rendering with Linux: Overview]에서 가져온 것입니다.

![HarfBuzz](https://mrandri19.github.io/assets/images/modern-text-rendering-linux-overview/harfbuzz.svg)

문자를 올바른 위치에 놓으려면 TextMetrics를 얻어야 합니다. 가장 단순한 나란히 배치만 하더라도, 최소한 각 문자의 너비는 알아야 합니다. 아래에서는 브라우저 쪽에서 이를 얻는 방법에 집중합니다.

### TextMetrics {#textmetrics}

HTML 명세는 [TextMetrics]의 정의를 제공하며, 수평 방향과 수직 방향의 두 묶음으로 나뉩니다:

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

먼저 수평 방향의 세 속성에 주목합니다. 아래 그림은 [Differences between width and actualBoundingBoxLeft(Right)]에서 가져온 것으로, `width`와 `actualBoundingBoxLeft/Right` 사이에 차이가 있음을 알 수 있습니다. 간단히 말해 후자는 문자의 최대 경계를 나타냅니다(수직 방향의 `actualBoundingBoxAscent/Descent`도 같습니다). 반면 전자(파란색)는 후자의 합(빨간색 + 초록색)보다 얼마든지 작을 수 있습니다. 예를 들어 그림 오른쪽의 이탤릭 `f`는 font-kerning을 고려하면, 다음 문자도 `f`일 때 두 `f`가 서로 끼워지듯 나란히 놓일 수 있습니다.

![width와 actualBoundingBoxLeft(Right)](/text-metrics.png)

수직 방향 속성을 살펴봅니다. 아래 그림은 [Meaning of top, ascent, baseline, descent, bottom, and leading in Android's FontMetrics]에서 가져온 것입니다. 먼저 `text-baseline`을 찾고, `Ascent/Descent`로 끝나는 속성은 이를 기준으로 합니다.

![Android의 FontMetrics](/text-metrics2.png)

`text-baseline`의 값은 [text-baseline]을 참고할 수 있으며, 아래 그림과 같습니다. 예를 들어 `hanging` 값을 취하면 `hangingBaseline`의 값은 `0`이고, `alphabeticBaseline`의 값은 `alphabetic`에서 `hanging`까지의 거리입니다.

![text-baseline](/text-baseline.png)

마지막으로 `fontBoundingBoxAscent/Descent`는 글꼴 자체의 최대 경계이고, `actualBoundingBoxAscent/Descent`는 실제로 그릴 때 글꼴의 최대 경계입니다. 따라서 전자는 내용이 바뀌어도 높낮이가 들쭉날쭉하지 않은, 일관된 텍스트 배경을 그리는 데 적합합니다.

<TextBaseline2 />

### measureText {#measuretext}

[TextMetrics]는 어떻게 얻을까요? Canvas 2D API는 [measureText]를 제공하지만, 실제 사용할 때는 `width`만 쓸 수 있는 경우를 고려해야 합니다. [PIXI.TextMetrics]를 예로 들면, 구현에서 이 점을 반영하여 `actualBoundingBoxLeft/Right`가 모두 `0`이면 `width`를 사용합니다:

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

글꼴 관련 속성에서는 `Ascent/Descent`를 측정할 수 있도록 대표적인 문자 몇 개를 고르고, 값을 얻지 못하면 사용자가 직접 입력한 `fontSize` 값을 사용합니다.

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

Canvas 2D API 외에도 브라우저 쪽에는 다음과 같은 선택지가 있습니다.

-   [opentype.js]
-   use-gpu는 [ab-glyph](https://github.com/alexheretic/ab-glyph) 기반의 [use-gpu-text]를 사용합니다
-   점점 더 많은 애플리케이션이 [harfbuzzjs]를 사용합니다. 참고: [State of Text Rendering 2024]

> 웹에서 HarfBuzz를 쓰는 사례가 늘고 있습니다. 처음에는 JavaScript로 트랜스파일되었고, 최근에는 harfbuzzjs를 통해 WebAssembly로 크로스 컴파일됩니다. 온라인 사진 편집기인 Photopea 같은 앱이 이 방식을 사용합니다. Simon Cozens의 Crowbar는 HarfBuzz의 buffer-messaging API로 만든 OpenType 셰이핑 디버거 웹 앱입니다. Sploot은 Simon이 만든 또 다른 웹 앱으로, 글꼴 검사기입니다. Prezi와 [Figma](https://www.figma.com/)도 웹 앱에서 HarfBuzz를 사용합니다.

[What HarfBuzz doesn't do]에서 말하듯, 개별 문자의 측정 문제를 해결하는 것만으로는 한참 부족합니다. 다음으로 `letterSpacing`을 살펴봅니다.

> HarfBuzz는 셰이핑된 텍스트 조각의 너비를 알려 줄 수 있으며, 이는 양쪽 정렬 알고리즘에 유용한 입력입니다. 그러나 문단, 줄, 줄 길이에 대해서는 아무것도 모릅니다. 단어를 한 줄에 비례하여 맞추기 위해 **단어 사이의 간격을 조정**하지도 않습니다.

### letterSpacing {#letterspacing}

Canvas 2D API는 문자 사이 간격을 조정하는 [letterSpacing]을 제공합니다. 텍스트를 측정하기 전에 이 값을 설정합니다:

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

이후 각 문자의 위치를 배치할 때도 이를 고려해야 하며, [쿼드 생성](#generate-quads)에서 소개합니다.

## 문단 레이아웃 {#paragraph-layout}

개별 문자가 모여 문장이 되고, 문장이 모여 문단이 됩니다. 아래 그림은 [Text layout is a loose hierarchy of segmentation]에서 가져온 것으로, 텍스트 레이아웃의 계층 구조를 아래에서 위로 보여 줍니다.

![레이아웃 피라미드](https://raphlinus.github.io/assets/layout_pyramid.svg)

Canvas 2D API는 텍스트 그리기에서 문단 관련 기능을 제공하지 않고, 가장 기본적인 [Drawing text] 함수만 제공합니다. Skia 기반의 CanvasKit은 이를 확장하여 `drawParagraph` 메서드를 추가로 제공합니다. 참고: [CanvasKit Text Shaping]

> CanvasKit이 HTML Canvas API보다 제공하는 가장 큰 기능 중 하나는 **문단 셰이핑**입니다.

```ts
const paragraph = builder.build();
paragraph.layout(290); // width in pixels to use when wrapping text
canvas.drawParagraph(paragraph, 10, 10);
```

문단 분할부터 시작합니다.

### 문단 분할 {#paragraph-segmentation}

가장 단순한 분할 기준은 명시적인 줄바꿈입니다.

```ts
const newlines: number[] = [
    0x000a, // line feed
    0x000d, // carriage return
];
```

또한 자동 줄바꿈도 고려해야 합니다. 동시에 각 줄의 길이가 가능한 한 비슷해지도록 합니다. 참고: [Beautifying map labels with better line breaking]

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

CJK에서는 어떤 문자는 줄의 맨 앞에 올 수 없고, 어떤 문자는 줄의 맨 끝에 올 수 없습니다. 예를 들어 중국어에서는 대부분의 문장 부호가 줄의 맨 앞에 올 수 없습니다. 구체적인 규칙은 [Line breaking rules in East Asian languages]를 참고합니다. [pixi-cjk]는 이러한 경우를 처리합니다.

![pixi-cjk](https://github.com/huang-yuwei/pixi-cjk/raw/main/docs/screenshot.png)

자동 줄바꿈의 또 다른 흔한 경우는 최대 너비를 지정하고, 그 너비를 넘으면 다음 줄로 넘기는 것입니다. 더 나아가 최대 줄 수를 설정할 수 있고, 이 한도를 넘으면 [text-overflow] 속성이 적용됩니다.

```ts
{
    wordWrap: true,
    wordWrapWidth: 100,
    maxLines: 3,
    textOverflow: TextOverflow.ELLIPSIS,
}
```

Pixi.js의 구현을 참고할 수 있습니다. [CanvasTextMetrics]

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

HarfBuzz는 [BiDi]를 처리하지 않습니다. [What HarfBuzz doesn't do]를 참고합니다.

> HarfBuzz는 양방향성을 도와주지 않습니다.

::: info BiDi
왼쪽에서 오른쪽(영어)과 오른쪽에서 왼쪽(아랍어 또는 히브리어)이 섞인 텍스트를 처리하기 위한 지원입니다.
:::

예를 들어 LTR과 RTL이 섞인 내용 `ABCאבגDEF`는, 올바른 효과를 표시하려면 RTL 텍스트의 순서를 직접 바꿔야 합니다:

```ts
'ABCאבגDEF'.split(''); // ['A', 'B', 'C', 'ג' ,'ב' ,'א', 'D', 'E', 'F']
```

이 문제는 브라우저에서 쉽게 풀리지 않습니다. 참고: [BiDi in Pixi.js]. [mapbox-gl-rtl-text]와 [rtl-text]는 [International Components for Unicode (ICU)]를 WASM으로 이식했는데, 그러면 JS 번들 크기가 커집니다. 다만 지금은 [bidi-js]로 처리할 수 있으며, RTL 문자를 만나면 직접 순서를 뒤집어야 합니다:

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

인쇄된 아랍어에서 각 문자는 “고립(isolated)”, “어두(initial)”, “어중(medial)”, “어말(final)” 형태를 가질 수 있습니다. 예를 들어 아랍어 글자 “meem”(U+0645)의 네 가지 형태는 다음과 같습니다. 참고: [Improving Arabic and Hebrew text in map labels].

![Copyright © 2015–2017 W3C® https://w3c.github.io/alreq/](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*bw5EsYu7dRATHtvg.png)

ICU에 비해 훨씬 가벼운 [JavaScript-Arabic-Reshaper]를 선택합니다.

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

BiDi를 해결한 뒤에는 복합 문자 문제를 다뤄야 합니다. 다음 예는 Rust로 구현된 여러 줄 텍스트 처리 라이브러리인 [cosmic-text](https://github.com/pop-os/cosmic-text/blob/166b59f560c551dab391a864f7c1f503c1e18446/examples/editor-test/src/main.rs#L97-L101)에서 가져온 것입니다.

```rust
for line in BidiParagraphs::new(&text) {
    for grapheme in line.graphemes(true) {
        for c in grapheme.chars() {}
    }
}
```

### 복합 문자 {#cluster}

모든 문자가 단일 문자로 이루어지지는 않습니다. [clusters]는 HarfBuzz가 복합 문자를 다룰 때 쓰는 용어입니다.

> 텍스트 셰이핑에서 클러스터는 하나의 나눌 수 없는 단위로 다루어야 하는 문자의 나열입니다.

예를 들어 이모지가 그렇습니다. 단일 문자로 처리하면(예를 들어 `split('')`을 사용하면) 측정이든 이후의 그리기든 잘못 잘리게 됩니다:

```ts
'🌹'.length; // 2
'🌹'[0]; // '\uD83C'
'🌹'[1]; //'\uDF39'
```

브라우저 쪽에서는 [grapheme-splitter] 같은 라이브러리를 사용할 수 있으며, 사용법은 다음과 같습니다:

```ts
var splitter = new GraphemeSplitter();
// plain latin alphabet - nothing spectacular
splitter.splitGraphemes('abcd'); // returns ["a", "b", "c", "d"]
// two-char emojis and six-char combined emoji
splitter.splitGraphemes('🌷🎁💩😜👍🏳️‍🌈'); // returns ["🌷","🎁","💩","😜","👍","🏳️‍🌈"]
```

하지만 그 크기(압축 후에도 22kB)는 무시할 수 없습니다. [BundlePhobia grapheme-splitter]를 참고합니다. 그래서 Pixi.js에서는 기본적으로 브라우저 자체의 [Intl.Segmenter]로 복합 문자를 처리하며, 이 기능은 대부분의 최신 브라우저에서 지원됩니다:

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

우리도 이 방식을 채택하며, 나중에 문자의 SDF를 생성할 때 사용합니다.

### text-align {#text-align}

[text-align]을 구현하는 일은 간단합니다.

![text-align](/text-align.png)

```ts
let offsetX = 0;
if (textAlign === 'center') {
    offsetX -= width / 2;
} else if (textAlign === 'right' || textAlign === 'end') {
    offsetX -= width;
}
```

하지만 수직 정렬을 구현하는 일은 그렇게 간단하지 않습니다. [text-baseline]은 한 줄 텍스트에만 해당하고, 많은 경우 문단 전체를 가운데에 맞추고 싶습니다. flex 레이아웃을 다룰 때 소개하겠습니다.

## 렌더링 {#rendering}

아래 그림은 이 과정에서 [FreeType] 글꼴 렌더링 엔진의 위치를 보여 줍니다.

![FreeType](https://mrandri19.github.io/assets/images/modern-text-rendering-linux-overview/freetype.svg)

구체적인 텍스트 렌더링 기법에 집중해 보겠습니다. 문자 집합이 제한된 라틴 문자라면, 글리프 아틀라스를 오프라인으로 생성한 뒤 런타임에 GPU로 올리는 것이 충분히 가능하며, [freetype-gl]이 이 방식으로 구현되어 있습니다.

> 글리프 아틀라스는 타일의 나머지 데이터와 함께 GPU에 텍스처로 업로드되는 하나의 이미지입니다. 다음은 글리프 아틀라스를 시각적으로 나타낸 것입니다.

다음 그림은 [Drawing Text with Signed Distance Fields in Mapbox GL]에서 가져온 것입니다.

![글리프 아틀라스](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*POsS7DlWOnqaJXI_.jpg)

하지만 이 비벡터 방식의 문제는 확대하면 문자가 매우 흐려진다는 점입니다. 아래 그림은 [Distance field fonts]에서 가져온 것입니다.

![거리 필드 글꼴은 선명함을 유지한다](https://libgdx.com/assets/wiki/images/distance-field-fonts.png)

현재 주류인 SDF 기반 해법은 Valve의 논문 [Improved Alpha-Tested Magnification for Vector Textures and Special Effects]에서 나왔으며, 이 해법의 장점은 다음과 같습니다.

-   확대해도 선명하게 유지됩니다
-   안티앨리어싱, 헤일로(Halo), 그림자 등의 기능을 구현하기 쉽습니다

하지만 가장자리가 충분히 날카롭지 않다는 문제가 있습니다. 다만 시각화 장면에서는 허용 범위가 더 넓고, msdf 같은 방법으로 최적화할 수도 있습니다. 또한 SDF는 [font hinting]도 지원하지 못합니다.

먼저 단일 문자의 SDF 생성 상황을 살펴보겠습니다.

### SDF 생성 {#generate-sdf}

아래 그림은 [msdf-atlas-gen]에서 가져온 것이며, SDF와 MSDF 두 종류의 아틀라스에 주목합니다.

|                  | 하드 마스크 | 소프트 마스크 | SDF | PSDF | MSDF | MTSDF |
| ---------------- | ----------- | ------------- | --- | ---- | ---- | ----- |
| 채널:            | 1 (1-bit)   | 1             | 1   | 1    | 3    | 4     |
| 안티앨리어싱:    | -           | 예            | 예  | 예   | 예   | 예    |
| 확대 가능:       | -           | -             | 예  | 예   | 예   | 예    |
| 날카로운 모서리: | -           | -             | -   | -    | 예   | 예    |
| 부드러운 효과:   | -           | -             | 예  | -    | -    | 예    |
| 하드 효과:       | -           | -             | -   | 예   | 예   | 예    |

오프라인 생성이 허용된다면 [msdf-atlas-gen]이나 [node-fontnik]을 사용할 수 있습니다(mapbox는 서버에서 protocol buffer로 인코딩된 SDF를 생성하는 데 이를 사용합니다). 하지만 CJK 문자를 고려하면 런타임 생성에 [tiny-sdf]를 사용할 수 있으며, 사용법은 다음과 같습니다. 글꼴 관련 속성을 넘기면 픽셀 데이터를 얻습니다.

```ts
const tinySdf = new TinySDF({
    fontSize: 24,
    fontFamily: 'sans-serif',
});
const glyph = tinySdf.draw('泽'); // Contains pixel data, width and height, character metrics, etc.
```

생성 원리를 간단히 분석해 보겠습니다. 먼저 브라우저 Canvas2D API인 [getImageData]로 픽셀 데이터를 얻지만, 쓸 때는 버퍼 여백을 둡니다. 이는 헤일로(Halo) 구현을 고려한 것입니다.

```ts
const size = (this.size = fontSize + buffer * 4);
```

가장 무식한 전수 탐색인 $O(n^2)$은 분명 받아들일 수 없습니다. 300K 이미지라면 거리 계산이 900억 번이라는 뜻이며, 런타임에 끝내려면 효율적인 $O(n)$ 알고리즘이 필요합니다.

2차원 격자에서 거리 필드의 “거리”는 유클리드 거리이므로, EDT(Euclidean Distance Transform)는 다음과 같이 정의됩니다. 여기서 $(x',y')$는 도형을 이루는 점의 집합이고, $f(x, y)$는 샘플링된 함수입니다. 격자에서 $(x,y) \in P$이면 $f(x, y) = 0$이고, 그렇지 않으면 $\infty$입니다.

$$ \mathcal{D}_f(x,y) = \min_{x',y'} \left( (x - x')^2 + (y - y')^2 + f(x', y') \right) $$

여기서 첫 부분은 $y'$와 무관하므로, 두 번의 1차원 DT 계산으로 펼칠 수 있습니다. 첫 번째 패스는 $x'$를 고정합니다.

$$
\begin{align*}
\mathcal{D}_f(x,y) &= \min_{x'} \left( (x - x')^2 + \min_{y'} \left( (y - y')^2 + f(x', y') \right) \right), \\
&= \min_{x'} \left( (x - x')^2 + \mathcal{D}_{f_{|x'}}(y) \right),
\end{align*}
$$

따라서 1차원 거리 제곱만 고려하면 됩니다.

$$ \mathcal{D}_f(p) = \min_{q \in \mathcal{G}} \left( (p - q)^2 + f(q) \right) $$

위의 1차원 거리 제곱 필드 계산식을 기하학적으로 이해하면, 사실 포물선들의 집합입니다. 각 포물선의 최저점은 $(q, f(q))$에 있으며, 아래 그림은 원논문 [Distance Transforms of Sampled Functions]에서 가져온 것입니다.

![샘플링된 함수의 거리 변환](/dt-sampled-functions.png)

따라서 이 포물선 집합의 하한, 즉 아래 그림의 실선 부분이 EDT의 계산 결과를 나타냅니다.

![EDT](https://pica.zhimg.com/v2-2dd0b94f2de83162f314300b933a3708_1440w.jpg)

이 하한을 찾으려면 임의의 두 포물선의 교점을 계산해야 합니다. 예를 들어 두 포물선 $(x=r, x=q)$에 대해 교점의 가로 좌표 $s$는 다음과 같습니다.

$$ s = \frac{(f(r) + r^2) - (f(q) + q^2)}{2r - 2q} $$

이제 EDT 1D를 계산할 준비가 되었습니다. 하한에서 가장 오른쪽 포물선의 일련번호를 $v[]$에 저장합니다. 하한 포물선의 각 구간 경계는 $z[]$에 저장합니다. 이렇게 하면 다음 포물선 $x=q$를 계산할 때 $v[k]$ 포물선과의 교점만 구하면 되고, 교점의 가로 좌표와 $z[k]$의 위치 관계는 두 가지뿐입니다.

![지금까지 구성한 하한 포락선에 q의 포물선을 추가할 때 알고리즘이 고려하는 두 가지 경우](/dt-2-possible-cases.png)

완전한 알고리즘은 다음과 같으며, [tiny-sdf]가 이를 구현합니다(EDT 1D). 변수 이름까지 일치합니다.

![제곱 유클리드 거리에서의 1차원 거리 변환](/dt-euclidean-distance.png)

[Sub-pixel Distance Transform]은 이 알고리즘의 아이디어를 자세히 소개합니다. 안쪽 거리 필드와 바깥쪽 거리 필드를 따로 계산한 뒤 둘을 합칩니다.

> 부호 있는 거리 필드를 만들려면 안쪽과 바깥쪽에 대해 각각 이렇게 한 다음, 둘을 안쪽 − 바깥쪽, 또는 그 반대로 합칩니다.

가장 기본적인 1D에서 시작합니다. 먼저 입력이 검은색과 흰색뿐이라고, 즉 앞에서 말한 하드 마스크라고 가정하고, 바깥쪽 거리 필드를 먼저 계산합니다.

![픽셀 행](https://acko.net/files/gpubox/image/pixels-row.png)

$$ O = [\infty, \infty, \infty, 0, 0, 0, 0, 0, \infty, 0, 0, 0, \infty, \infty, \infty] $$
$$ P = [3, 2, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3] $$

다음으로 안쪽 거리 필드를 계산합니다. `I`는 `O`를 뒤집은 것입니다.

$$ I = [0, 0, 0, \infty, \infty, \infty, \infty, \infty, 0, \infty, \infty, \infty, 0, 0, 0] $$
$$ N = [0, 0, 0, 1, 2, 3, 2, 1, 0, 1, 2, 1, 0, 0, 0] $$

마지막으로 합칩니다. 바깥쪽 거리 필드에서 안쪽 거리 필드를 뺍니다.

$$ P - N = [3, 2, 1,-1,-2,-3,-2,-1, 1,-1,-2,-1, 1, 2, 3] $$

[tiny-sdf]의 구현에서 위 과정은 `a`가 `1`일 때의 처리 논리에 해당합니다:

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

2D EDT의 계산은 이 절의 처음에 소개한 대로, 1차원 거리 제곱을 두 패스로 나눈 뒤 마지막으로 제곱근을 구합니다. 후처리의 가우시안 블러와 비슷합니다.

> 푸리에 변환과 같이, 각 행 X에 수평으로 적용한 다음 각 열 Y에 수직으로 적용하면(또는 그 반대로 하면) 2D 이미지에 적용할 수 있습니다.

여기서 `height * width` 크기의 격자에 대해 복잡도가 $O(n)$임을 바로 알 수 있습니다:

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

단일 문자의 SDF 생성 문제를 해결했으면, 다음 단계는 모든 문자의 SDF를 하나의 큰 이미지로 합치는 것입니다. 이 이미지는 나중에 텍스처로 사용됩니다.

### 글리프 아틀라스 {#glyph-atlas}

개별 SDF는 나중에 텍스처로 쓰기 위해 하나의 큰 이미지로 합쳐야 하며, CSS Sprite와 비슷합니다. 이런 문제를 [Bin packing problem]이라고 합니다. 작은 상자를 큰 상자에 넣으면서 공간을 합리적으로 써서 틈을 줄입니다. 우리는 [potpack]을 선택합니다. 이 알고리즘은 가능한 한 정사각형에 가까운 결과를 얻지만, 레이아웃을 생성한 뒤에는 수정할 수 없고 다시 생성만 할 수 있다는 단점이 있습니다.

![potpack으로 만든 글리프 아틀라스](https://miro.medium.com/v2/resize:fit:1024/format:webp/0*YcJm5NJXJCIO20ds.png)

아틀라스는 텍스트 배치가 현재 사용하는 글리프를 저장합니다. 첫 빌드에는 빈 텍스트도 유효한 메트릭을 갖도록 공백 글리프를 함께 넣습니다. 새 문자가 생기거나 글꼴 패밀리, 굵기, 스타일, 채우기가 바뀌면 아틀라스를 다시 만들 수 있고, 글꼴 크기만 바꿀 때는 그대로 재사용합니다. 보이는 문자만 생성하면, 라벨이 많은 SVG를 가져올 때 텍스트 스타일마다 쓰이지 않는 ASCII 글리프 96개를 미리 구워 넣는 일을 피할 수 있습니다.

이 텍스처는 채널 하나만 쓰면 됩니다. WebGL이라면 `gl.ALPHA` 형식을 쓸 수 있지만, WebGPU에는 대응하는 형식이 없습니다. 그래서 `Format.U8_R_NORM` 형식을 사용합니다. 이는 WebGL에서는 `gl.LUMINANCE`이고 WebGPU에서는 [r8unorm]입니다.

```ts
this.glyphAtlasTexture = device.createTexture({
    ...makeTextureDescriptor2D(Format.U8_R_NORM, atlasWidth, atlasHeight, 1),
    pixelStore: {
        unpackFlipY: false,
        unpackAlignment: 1,
    },
});
```

그런 다음 셰이더에서 `r` 채널로부터 부호 있는 거리를 얻습니다:

```glsl
uniform sampler2D u_SDFMap; // glyph atlas
varying vec2 v_UV;

float dist = texture2D(u_SDFMap, v_UV).r;
```

위는 프래그먼트 셰이더의 그리기 논리입니다. 정점 셰이더로 넘기는 각 문자의 위치를 어떻게 계산하는지 살펴보겠습니다.

### 쿼드 생성 {#generate-quads}

먼저 각 글리프를 글리프 데이터에서 두 개의 삼각형(이를 “quad”라고 합니다)으로 바꿔야 하며, 정점은 네 개입니다.

![텍스처가 입혀진 삼각형 메시로 나타낸 텍스트 문자열](/glyph-quad.png)

단순화한 글리프 데이터 `SymbolQuad`는 다음과 같이 정의됩니다:

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

각 글리프 데이터는 네 개의 정점으로 나누며, uv와 offset을 하나의 stride로 합친 뒤 정점 셰이더에서 `a_UvOffset`으로 접근합니다:

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

정점 셰이더에서는 uv를 텍스처 크기로 나누어, 프래그먼트 셰이더로 넘겨 글리프 아틀라스를 샘플링할 텍스처 좌표를 얻습니다. 동시에 offset에 글꼴 스케일을 곱해 앵커 포인트 기준의 오프셋을 구하고, 마지막으로 위치와 오프셋을 더해 최종 정점 위치를 얻습니다:

```glsl
v_Uv = a_UvOffset.xy / u_AtlasSize;

vec2 offset = a_UvOffset.zw * fontScale;
gl_Position = vec4((u_ProjectionMatrix
    * u_ViewMatrix
    * u_ModelMatrix
    * vec3(a_Position + offset, 1)).xy, zIndex, 1);
```

마지막으로 글리프 데이터를 어떻게 계산하는지 살펴보겠습니다. 이전 절에서 문단을 분할한 뒤 여러 줄의 문자열 배열 `lines`를 얻었고, `textAlign` `letterSpacing` `fontMetrics`와 함께 각 문자의 앵커 포인트 기준 위치 정보를 계산합니다.

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

여기서는 [mapbox-gl-js shaping.ts]의 구현을 참고합니다:

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

## 개선 {#improvements}

현재 렌더링된 텍스트는 확대하면 뚜렷한 “인공적인 흔적”이 있습니다. 분명한 이유 하나는 생성된 SDF의 해상도입니다. Mapbox의 현재 구현에서는 `SDF_SCALE`로 이를 제어합니다. 생성된 SDF의 해상도가 높을수록 더 섬세하지만, 성능도 떨어집니다.

<https://github.com/mapbox/mapbox-gl-js/blob/main/src/render/glyph_manager.ts#L34>

> SDF_SCALE의 선택은 성능과 품질 사이의 절충입니다.
> 글리프 생성 시간은 스케일에 따라 제곱으로 늘어나지만, 품질 향상은 스케일이 기기의 픽셀 비율보다 커지면 급격히 줄어듭니다. 스케일 2는 받아들일 수 있는 비용으로 HDPI 화면에서 눈에 띄는 개선을 얻습니다.

아래 그림은 `SDF_SCALE`이 1과 4일 때 확대한 비교 결과입니다.

|           SDF_SCALE = 1           |           SDF_SCALE = 4           |
| :-------------------------------: | :-------------------------------: |
| ![sdf 스케일 1](/sdf-scale-1.png) | ![sdf 스케일 4](/sdf-scale-4.png) |

하지만 먼저 SDF 해상도는 조정하지 않겠습니다. [tiny-sdf]의 현재 구현에는 여전히 문제가 있습니다.

### 서브픽셀 거리 변환 {#sub-pixel-distance-transform}

[Sub-pixel Distance Transform]은 [tiny-sdf] 구현에 문제가 있음을 지적하고, 개선된 구현을 제시합니다.

먼저 Canvas로 흑백만 있는 하드 마스크가 아니라 회색조 이미지를 생성합니다.

![회색 픽셀 행](https://acko.net/files/gpubox/image/pixels-row-grey.png)

[tiny-sdf]의 구현에서 `a`가 1이 아닐 때는 다음과 같이 처리합니다:

```ts
// @see https://github.com/mapbox/tiny-sdf/blob/main/index.js#L89
if (a === 1) {
} else {
    const d = 0.5 - a; // aliased pixels
    gridOuter[j] = d > 0 ? d * d : 0;
    gridInner[j] = d < 0 ? d * d : 0;
}
```

![tiny-sdf와 use.gpu의 비교](https://acko.net/files/gpubox/image/glyph-xy-compare-t@2x.png)

### MSDF {#msdf}

저해상도 거리 필드로 복원하면 문자의 모서리가 너무 부드러워져 원래의 날카로움을 유지하지 못합니다. 이제 이 문제를 해결해 보겠습니다.

![sdf와 msdf의 비교](/msdf-vs-sdf.png)

거리 필드에는 집합 연산을 적용할 수 있습니다. 아래 그림은 [Shape Decomposition for Multi-channel Distance Fields]에서 가져온 것으로, 두 거리 필드를 비트맵의 두 성분(R, G)에 각각 저장합니다. 복원할 때 이 두 거리 필드는 모서리에서 부드럽지만, 교집합을 쓰면 날카롭게 복원하는 효과를 얻을 수 있습니다.

![도형을 두 개의 둥근 도형의 합집합으로 분해할 수 있는 한 가지 방법](/msdf.png)

분해 알고리즘은 원논문 [Shape Decomposition for Multi-channel Distance Fields]의 4.4절 Direct multi-channel distance field construction을 참고할 수 있습니다. 실제 사용에서는 저자가 [msdfgen]을 제공하며, 저해상도에서 MSDF의 효과가 훨씬 좋고 더 높은 해상도의 SDF보다도 낫다는 것을 알 수 있습니다.

생성 도구로는 온라인 도구인 [MSDF font generator]와 CLI 도구인 [msdf-bmfont-xml]이 있습니다. 이 도구들은 MSDF 아틀라스를 생성하는 동시에, 이후 그리기에 쓸 각 문자의 레이아웃 정보가 담긴 `fnt` 또는 `json` 파일도 생성합니다. [pixi-msdf-text]는 Pixi.js를 사용한 완전한 예이며, [BitmapFontLoader]로 `fnt` 파일을 불러옵니다. 우리 프로젝트도 그 구현을 참고합니다.

프래그먼트 셰이더에서 `median`으로 복원할 때:

```glsl
float median(float r, float g, float b) {
  return max(min(r, g), min(max(r, g), b));
}

#ifdef USE_MSDF
    vec3 s = texture(SAMPLER_2D(u_Texture), v_Uv).rgb;
    float dist = median(s.r, s.g, s.b);
#else
```

아래 예에서는 확대해도 문자의 가장자리가 날카롭게 유지되는 것을 볼 수 있습니다.

<MSDFText />

### font-kerning {#font-kerning}

미리 생성한 비트맵 글꼴에는 `kernings`를 넣을 수 있으며, 고정된 순서의 두 문자 사이 간격을 조정할 수 있습니다.

예를 들어 <https://pixijs.com/assets/bitmap-font/desyrel.xml>

```xml
<kernings count="1816">
    <kerning first="102" second="102" amount="2" />
    <kerning first="102" second="106" amount="-2" />
</kernings>
```

바운딩 박스 계산과 레이아웃 모두 이를 고려해야 합니다. 다음 예는 그 차이를 보여 줍니다.

<BitmapFont />

런타임에 [font-kerning]을 얻으려면 <https://github.com/mapbox/tiny-sdf/issues/6#issuecomment-1532395796>에서 제시한 방법을 참고할 수 있습니다.

![font-kerning](https://developer.mozilla.org/en-US/docs/Web/CSS/font-kerning/font-kerning.png)

```ts
const unkernedWidth =
    tinySdf.ctx.measureText('A').width + tinySdf.ctx.measureText('V').width;
const kernedWidth = tinySdf.ctx.measureText('AV').width;
const kerning = kernedWidth - unkernedWidth; // a negative value indicates you should adjust the SDFs closer together by that much
```

### 이모지 {#emoji}

[EmojiEngine]처럼 일부 이모지 렌더링 구현은 미리 생성한 이모지 아틀라스 방식을 사용합니다. 하지만 이 방식은 텍스처 크기 제한이 있을 뿐 아니라, 플랫폼마다 다른 이모지 모양을 유지하지도 못합니다. 그래서 SDF와 비슷하게, 현재 플랫폼의 런타임에서 필요할 때 이모지를 생성하고자 합니다.

이 방식과 SDF의 가장 큰 차이는 알파 채널만 남길 수 없고, 이후의 거리 필드 복원을 위해 RGB 세 채널을 모두 보존해야 한다는 점입니다.

<Emoji />

## SVG 내보내기 {#export-svg}

여러 줄 텍스트를 SVG로 내보낼 때는 `<tspan>`을 사용할 수 있으며, `dy`를 측정한 줄 높이로 설정합니다:

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

## 더 읽어보기 {#extended-reading}

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
