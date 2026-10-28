---
outline: deep
description: '캔버스 내용을 PNG, JPEG, SVG 형식으로 내보내는 방법을 알아봅니다. 캔버스에서 이미지를 렌더링하고, stroke-alignment 같은 기능으로 SVG 능력을 확장해 디자인 도구를 강화합니다.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: '10강 - 이미지 가져오기와 내보내기',
          },
      ]
---

<script setup>
import ObjectFit from '../../components/ObjectFit.vue';
</script>

# 10강 - 이미지 가져오기와 내보내기 {#lesson-10-importing-and-exporting-images}

이미지 가져오기와 내보내기는 무한 캔버스에서 매우 중요한 기능이며, 내보낸 이미지를 통해 다른 도구와 연동할 수 있습니다. 현재 캔버스의 그리기 능력은 아직 제한적이지만, 이미지와 관련된 문제를 미리 생각해 두는 것이 좋습니다. 이번 강의에서는 다음 내용을 다룹니다.

-   캔버스 내용을 PNG, JPEG, SVG로 내보내고, 시간 기반 효과를 GIF로 내보내기
-   캔버스에서 이미지 렌더링하기. 이미지 채우기의 `object-fit` / `object-position`을 포함합니다
-   `stroke-alignment`를 예로 들어 SVG 능력을 확장하기

## 캔버스 내용을 이미지로 내보내기 {#export-canvas-to-image}

먼저 캔버스 내용을 이미지로 내보내는 방법을 살펴보겠습니다. [Export from Figma]에서는 Figma의 슬라이스 도구로 PNG를 포함한 여러 형식으로 캔버스를 내보내는 방법을 설명합니다.

![Figma에서 내보내기](https://help.figma.com/hc/article_attachments/24423129974679)

Canvas2D 구현을 기반으로 한 일부 차트 라이브러리도 내용을 이미지로 저장하는 기능을 제공합니다. 아래 이미지는 Highcharts에서 가져온 것으로, 여러 형식의 이미지 내보내기를 제공하며 클릭하면 곧바로 브라우저의 다운로드가 시작되는 것을 볼 수 있습니다.

<img alt="Highcharts의 내보내기" src="https://user-images.githubusercontent.com/3608471/174998577-df1c54e9-d981-4d82-a4aa-7f0bedfb11a1.png" width="300" />

다음과 같은 내보내기 기능을 구현하고자 합니다.

-   여러 이미지 형식 지원: PNG, JPEG, SVG
-   잘라낼 영역 지정 지원
-   그리드 포함 여부 선택 지원

이를 위해 이미지 내보내기를 다음과 같이 사용하도록 설계했습니다.

```ts
const exporter = new ImageExporter({
    canvas,
});

const canvas = await exporter.toCanvas(); // HTMLCanvasElement
const dataURL = canvas.toDataURL(); // data:...

exporter.downloadImage({
    dataURL,
    name: 'my-file',
});
```

다만 이미지 형식에 따라 “약간의” 차이가 있습니다. 아래에서는 먼저 PNG / JPEG 형식 이미지를 내보내는 방법을 소개합니다.

### PNG / JPEG 내보내기 {#to-raster-image}

[HTMLCanvasElement.toDataURL()]로 캔버스 내용에 해당하는 이미지 [DataURI]를 얻을 수 있습니다. `type` 매개변수로 이미지 형식을 지정할 수 있으며, PNG / JPEG와 WebP를 지원합니다.

```js
var canvas = document.getElementById('canvas');
var dataURL = canvas.toDataURL(); // 默认为 PNG
console.log(dataURL);
// "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNby
// blAAAADElEQVQImWNgoBMAAABpAAFEI8ARAAAAAElFTkSuQmCC"
```

그래서 이미지 내보내기에 `toCanvas` 메서드를 추가합니다. 이 메서드는 지정한 영역의 캔버스 내용을 별도의 HTMLCanvasElement에 그린 뒤, 필요에 따라 배경색이나 워터마크 등을 더하는 식으로 이어서 가공할 수 있게 합니다. 전체 메서드 시그니처는 아래와 같습니다. 이 메서드는 비동기이며, 그 이유는 나중에 설명합니다.

```ts
toCanvas(options: Partial<CanvasOptions> = {}): Promise<HTMLCanvasElement>;

interface CanvasOptions {
  grid: boolean;
  clippingRegion: Rectangle;
  beforeDrawImage: (context: CanvasRenderingContext2D) => void;
  afterDrawImage: (context: CanvasRenderingContext2D) => void;
}
```

각 설정 항목의 의미는 다음과 같습니다.

-   `grid` 그리드를 포함할지 여부
-   `clippingRegion` 사각형으로 표현하는 캔버스 클리핑 영역
-   `beforeDrawImage` 캔버스 내용을 그리기 전에 호출되며, 배경색을 그리기에 적합합니다.
-   `afterDrawImage` 캔버스 내용을 그린 뒤에 호출되며, 워터마크를 그리기에 적합합니다.

전체 사용 예는 다음과 같습니다.

```ts
const canvas = await exporter.toCanvas({
    clippingRegion: new Rectangle(
        clippingRegionX,
        clippingRegionY,
        clippingRegionWidth,
        clippingRegionHeight,
    ),
    beforeDrawImage: (context) => {
        // Customize background-color
        context.fillStyle = backgroundColor;
        context.fillRect(0, 0, clippingRegionWidth, clippingRegionHeight);
    },
    afterDrawImage: (context) => {
        // Watermark
        context.font = '24px Times New Roman';
        context.fillStyle = '#FFC82C';
        context.fillText('Watermark', 20, 20);
    },
});
```

캔버스 오른쪽 위에 이미지 내보내기 드롭다운을 두었습니다. 컴포넌트에 관심이 있다면 [Web UI with Lit and Shoelace]를 참고하세요.

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas-lesson10');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson10;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas.parentElement.style.position = 'relative';
    $icCanvas.parentElement.appendChild($stats);

    $icCanvas.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        for (let i = 0; i < 100; i++) {
            const fill = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
                Math.random() * 255,
            )},${Math.floor(Math.random() * 255)})`;
            const circle = new Circle({
                cx: Math.random() * 600,
                cy: Math.random() * 400,
                r: Math.random() * 40,
                fill,
            });
            canvas.appendChild(circle);

            circle.addEventListener('pointerenter', () => {
                circle.fill = 'red';
            });
            circle.addEventListener('pointerleave', () => {
                circle.fill = fill;
            });
        }
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

이제 `toCanvas` 메서드를 비동기로 설계한 이유를 설명하겠습니다. WebGL / WebGPU는 [SwapChain] 더블 버퍼링을 사용하고, 컨텍스트를 만들 때 [preserveDrawingBuffer]의 기본값이 `false`이므로, `toDataURL`을 호출할 때 렌더링 결과가 지워지지 않도록 해야 합니다(예를 들어 `gl.clear()`를 호출하면 안 됩니다). 그렇지 않으면 빈 이미지가 나옵니다. [Plugin-based architecture]의 `endFrame` 훅에 다음 로직을 추가하여, 내보내기 명령을 받는 즉시 현재 프레임이 끝나기 전에 캔버스 내용을 저장합니다. 다음 프레임이 도착할 때 지워지면 안 되기 때문이며, 이 때문에 동작이 비동기가 됩니다.

```ts
hooks.endFrame.tap(() => {
    this.#device.endFrame();

    // capture here since we don't preserve drawing buffer
    if (this.#enableCapture && this.#resolveCapturePromise) {
        const { type, encoderOptions } = this.#captureOptions;
        const dataURL = (
            this.#swapChain.getCanvas() as HTMLCanvasElement
        ).toDataURL(type, encoderOptions);
        this.#resolveCapturePromise(dataURL);
        this.#enableCapture = false;
        this.#captureOptions = undefined;
        this.#resolveCapturePromise = undefined;
    }
});
```

또한 내보낸 이미지에 [Grid]를 포함할지 선택할 수 있습니다. 당장은 이후 가공에 잘라내기와 워터마크 기능을 사용하지 않습니다. Figma와 비슷한 “슬라이스” 기능은 박스 선택 상호작용이 필요하므로, 이후 구현에서 소개합니다. 이제 또 다른 특수한 이미지 형식으로 돌아가겠습니다.

### SVG 내보내기 {#to-vector-image}

비트맵에 비해 벡터 그래픽의 장점은 다음과 같습니다.

-   왜곡 없이 무한히 확대·축소할 수 있습니다. 선명도를 잃지 않고 얼마든지 키우거나 줄일 수 있어, 여러 해상도가 필요한 상황에 적합합니다.
-   편집 가능성: SVG는 텍스트 파일이므로 어떤 텍스트 편집기로도 편집할 수 있어, 그래픽의 속성과 스타일을 쉽게 수정할 수 있습니다.
-   SVG는 텍스트 파일이므로 어떤 텍스트 편집기로도 편집할 수 있어, 그래픽의 속성과 스타일을 쉽게 수정할 수 있습니다.

따라서 디자인 도구는 이 형식으로의 변환을 반드시 지원해야 합니다. 무한 캔버스에서는 문제를 이렇게 바꿀 수 있습니다. **씬 그래프를 어떻게 직렬화할 것인가**. 각 노드의 그리기 속성, 변환 등을 포함합니다. 직렬화 형식은 JSON 외에도, 2D 도형의 그리기 속성 설계 자체가 SVG 구현을 많이 참고했기 때문에 SVG로 내보내는 것이 자연스럽습니다.

흥미롭게도 Three.js도 [toJSON]으로 씬의 현재 상태(객체, 변환, 머티리얼 등)를 [JSON-Object-Scene-format-4]로 저장합니다. 제한된 조건(복잡한 셰이딩과 그림자 없음)에서 3D 그래픽을 가능한 한 렌더링하는 [SVGRenderer]도 있습니다.

#### 도형에서 SerializedNode로 {#shape-to-serialized-node}

많은 화이트보드 도구도 자체 그래픽 직렬화 형식을 제공합니다. 예를 들어 [JSON objects in tldraw]와 [JSON schema in excalidraw]가 있습니다.

씬 그래프의 루트 노드부터 순회하며 자식 요소에 재귀적으로 호출합니다. `transform`처럼 구조가 복잡한 값(`position/scale/rotation`)을 가진 속성은 추가 처리가 필요합니다.

```ts
function serializeNode(node: Shape): SerializedNode {
    const [type, attributes] = typeofShape(node);
    const data: SerializedNode = {
        type,
        attributes,
    };
    data.attributes.transform = serializeTransform(node.transform);
    data.children = node.children.map(serializeNode);
    return data;
}
```

아래 Circle을 예로 들면, 직렬화된 객체를 얻습니다.

```js eval code=true
serializedCircle = call(() => {
    const { Circle, serializeNode } = Lesson10;
    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 50,
        fill: 'red',
    });
    circle.transform.position.x = 100;
    return serializeNode(circle);
});
```

deserialize 메서드로 캔버스에 다시 가져올 수 있습니다. `deserializeNode`는 직렬화된 노드의 `type` 속성에 따라 해당하는 도형을 만들고, 그리기 속성에 값을 할당합니다.

```js eval code=false inspector=false
canvas2 = (async () => {
    const { Canvas } = Lesson10;

    const canvas = await Utils.createCanvas(Canvas, 200, 200);

    let id;
    const animate = () => {
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });

    return canvas;
})();
```

```js eval code=true
call(async () => {
    const { deserializeNode } = Lesson10;
    const circle = await deserializeNode(serializedCircle);
    canvas2.root.appendChild(circle);
    return canvas2.getDOM();
});
```

캔버스 전체의 직렬화와 역직렬화 메서드는 루트 노드에 그대로 적용하면 됩니다. 물론 이벤트 리스너는 직렬화할 수 없습니다.

```ts
const json = JSON.stringify(serializeNode(canvas.root)); // {}
canvas.root = (await deserializeNode(JSON.parse(json))) as Group;
```

#### SerializedNode에서 SVGElement로 {#serialized-node-to-svgelement}

이 시점에서는 직렬화된 노드를 [SVG Element]로 바꾸기 쉽습니다. 다음 도구 메서드를 추가합니다.

```ts
export function toSVGElement(node: SerializedNode): SVGElement;
```

`fill / stroke / opacity` 같은 속성의 대부분은 같은 이름의 SVG 속성이므로 [setAttribute]로 직접 할당할 수 있습니다. 다만 일부 속성은 특별히 처리해야 합니다. 예를 들면 다음과 같습니다.

-   `transform`은 `@pixi/math`의 `Transform` 객체를 사용하므로, `position / rotation / scale`을 `matrix()`로 변환해야 합니다.
-   `transform-origin`은 `transform`의 `pivot` 속성에 대응합니다.
-   `innerShadow`에는 같은 이름의 SVG 속성이 없어 필터로 구현해야 합니다.
-   `outerShadow`도 위와 같습니다.

다음 예는 직렬화된 원을 `<circle>`로 변환한 결과입니다. HTML 페이지에 표시하려면 [\<svg\>] 안에 넣어야 하며, 크기는 캔버스와 같습니다.

```js eval code=true
call(() => {
    const { toSVGElement } = Lesson10;

    const $circle = toSVGElement(serializedCircle);
    const $svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    $svg.setAttribute('width', '200');
    $svg.setAttribute('height', '200');
    $svg.appendChild($circle);

    return $svg;
});
```

#### SVGElement에서 SerializedNode로 {#svgelement-to-serialized-node}

당연히 SVGElement에서 SerializedNode로 변환하는 메서드도 필요합니다.

```ts
export function fromSVGElement(element: SVGElement): SerializedNode;
```

이 변환은 완전히 되돌릴 수 없습니다. 예를 들어 나중에 다룰 [StrokeAlignment 구현](#stroke-alignment-export-svg)에서는 Circle 하나가 `<circle>` 두 개에 대응합니다. Figma도 마찬가지입니다. 아래 이미지는 이전에 내보낸 Ellipse를 다시 가져온 결과이며, 두 도형이 완전히 같지 않은 것을 볼 수 있습니다.

![Figma에서 내보낸 타원 가져오기](/import-exported-ellipse.png)

[@pixi-essentials/svg]도 SVGElement를 Pixi.js의 도형으로 변환하려 합니다. [Vector rendering of SVG content with PixiJS]를 참고하세요.

#### SVG 속의 씬 그래프 {#scene-graph-in-svg}

또 하나 주의할 점은, 우리 씬 그래프에서는 어떤 도형도 자식 노드를 가질 수 있지만 SVG에서는 `<g>`만 자식을 가질 수 있고, `<circle>` 같은 요소는 자식을 가질 수 없다는 것입니다. 해결은 간단합니다. 자식을 가진 Group이 아닌 요소는 바깥에 `<g>`를 두어 SVG를 생성하고, 원래 그 요소에 적용했을 `transform`을 적용합니다. 나중에 텍스트 렌더링을 지원한다고 가정하면, 텍스트 자식을 가진 Circle의 SVG는 다음과 같습니다.

```html
<g transform="matrix(1,0,0,0,1,0)">
    <circle cx="100" cy="100" r="100" fill="red" />
    <text />
</g>
```

#### innerShadow와 outerShadow 내보내기 {#export-inner-outer-shadow}

[Adding Shadows to SVG Icons With CSS and SVG Filters]를 참고하여 [filter primitive]로 안쪽 그림자와 바깥쪽 그림자를 구현합니다. 바깥쪽 그림자 예는 다음과 같습니다.

```ts
const $feDropShadow = createSVGElement('feDropShadow', doc);
$feDropShadow.setAttribute('dx', `${(dropShadowOffsetX || 0) / 2}`);
$feDropShadow.setAttribute('dy', `${(dropShadowOffsetY || 0) / 2}`);
$feDropShadow.setAttribute(
    'stdDeviation',
    `${(dropShadowBlurRadius || 0) / 4}`,
);
$feDropShadow.setAttribute('flood-color', dropShadowColor);
$filter.appendChild($feDropShadow);
```

안쪽 그림자는 조금 더 복잡하므로, 지면 관계상 펼치지 않겠습니다. 아래 예에서 SVG를 내려받아 확인할 수 있습니다.

```js eval code=false
$icCanvas4 = call(() => {
    return document.createElement('ic-canvas-lesson10');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Rect } = Lesson10;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas4.parentElement.style.position = 'relative';
    $icCanvas4.parentElement.appendChild($stats);

    $icCanvas4.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        const rect = new Rect({
            x: 50,
            y: 50,
            fill: 'green',
            cornerRadius: 50,
            batchable: false,
            innerShadowColor: 'black',
            innerShadowOffsetX: 10,
            innerShadowOffsetY: 10,
            innerShadowBlurRadius: 10,
            dropShadowColor: 'black',
            dropShadowOffsetX: 10,
            dropShadowOffsetY: 10,
            dropShadowBlurRadius: 10,
        });
        rect.width = 400;
        rect.height = 100;
        canvas.appendChild(rect);
    });

    $icCanvas4.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

#### fill 값으로 이미지 내보내기 {#export-image-as-fill-value}

채우기 이미지 구현은 아직 다루지 않았지만, `fill` 속성의 Image 값을 그대로 직렬화하면 다음과 같이 됩니다.

```html
<circle fill="[object ImageBitmap]" />
```

이것은 제대로 표시되지 않습니다. Image 객체를 DataURL로 직렬화해야 하며, 이미지를 `<canvas>`에 그린 뒤 이전 절에서 소개한 `toDataURL` 메서드를 사용하면 됩니다. [Convert ImageBitmap to Blob]을 참고해 먼저 [ImageBitmapRenderingContext]를 시도했습니다. ImageBitmap은 메인 스레드를 막지 않고 이미지를 비동기로 디코드할 수 있어, 애플리케이션의 성능과 응답성을 높이는 데 도움이 됩니다.

```ts
async function imageBitmapToURL(bmp: ImageBitmap) {
    const canvas = document.createElement('canvas');
    // resize it to the size of our ImageBitmap
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    // get a bitmaprenderer context
    const ctx = canvas.getContext('bitmaprenderer');
    ctx.transferFromImageBitmap(bmp);
    const blob = await new Promise<Blob>((res) => canvas.toBlob(res));
    return canvas.toDataURL();
}
```

안타깝게도 다음 오류가 납니다. 이미 이 ImageBitmap으로 텍스처를 만들었기 때문에, 제어권을 새 `<canvas>`로 넘길 수 없기 때문입니다.

> [!CAUTION]
> The input ImageBitmap has been detached

그래서 일반적인 `drawImage` 메서드로 이미지를 `<canvas>`에 그리는 수밖에 없습니다.

#### ECS 페인트와 Rough 지오메트리 내보내기 {#ecs-export-paints}

ECS 내보내기는 `fills`와 `strokes`에서 처음 활성화된 레이어를 읽습니다. `image` 채우기는 도형 경계까지 늘어납니다. `pattern` 레이어는 디코드된 이미지를 원본 크기로 포함하고 `repeat`, `repeat-x`, `repeat-y` 또는 `no-repeat`를 유지합니다. SVG `<pattern>`은 로컬 좌표를 사용하며, 노드 변환은 감싸는 그룹에 한 번만 적용됩니다. 노드마다 반복 범위가 다르면 패턴 정의 ID도 따로 둡니다.

```ts
const elements = await serializeNodesToSVGElements([
    {
        id: 'tile',
        type: 'rect',
        zIndex: 0,
        x: 40,
        y: 30,
        width: 200,
        height: 100,
        fills: [
            { type: 'pattern', value: imageDataURL, repetition: 'repeat-x' },
        ],
    },
]);
```

이미지 디코딩은 비동기입니다. `serializeNodesToSVGElements`를 기다리거나, 더 낮은 수준의 도우미를 직접 쓸 때는 `exportFillGradientOrPattern` / `exportStrokeGradientOrPattern`을 기다리세요. 이미지 디코드에 실패하면 내보내기가 거부됩니다. 텍스트의 그라디언트, 이미지, 패턴 채우기는 정의가 `<text>` 요소와 함께 유지되므로, 내용을 써도 페인트 리소스가 제거되지 않습니다.

Rough 도형은 로컬 지오메트리를 SVG 패스로 내보냅니다. 그룹 불투명도, 채우기 레이어 불투명도, 스트로크 레이어 불투명도는 0을 포함해 각각 따로 유지됩니다. 해칭 스트로크는 `roughFillWeight`를 사용합니다(생략하거나 `-1`이면 윤곽선 너비의 절반). 타원은 `width`와 `height`에서 로컬 중심과 반지름을 구합니다. 이 SVG 패스를 다시 가져오면 렌더된 지오메트리는 유지되지만, 편집 가능한 Rough 매개변수는 복원되지 않습니다. 패턴 가져오기는 이번 내보내기 지원 범위에 포함되지 않습니다.

Canvas2D 결과가 필요한 호출자는 `API.renderToCanvas(node, { width, height })`로 해당 노드와 그 자식을 하나의 캔버스에 그립니다. 사각형, 타원, 패스, 폴리라인, 선의 단색 채우기와 스트로크, 그리고 이미지로 채운 사각형을 지원합니다. 각 도형은 자신의 패스에서 시작합니다. 호를 포함한 SVG 패스 명령과 `evenodd` 채우기 규칙은 Canvas2D용으로 변환됩니다. 로컬 위치, 둥근 모서리, 노드와 레이어의 불투명도는 유지됩니다. 자식 이미지는 다음 형제를 그리기 전에 디코딩을 마치므로 순서가 안정적으로 유지됩니다. 이미지를 디코드할 수 없으면 메서드가 거부되며, 전달된 캔버스는 다음 그리기에 그대로 쓸 수 있습니다.

#### SVG의 그리드 {#export-grid}

마지막으로 SVG로 그리드를 구현하는 방법을 살펴보겠습니다. [How to draw grid using HTML5 and canvas or SVG]를 참고하여 `<pattern>` 타일링을 사용합니다. 직선 그리드에는 크고 작은 두 세트를 쓰고, 점 그리드에는 “타일”의 네 모서리에 각각 원을 놓습니다.

<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="small-grid" width="10" height="10" patternUnits="userSpaceOnUse">
      <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(221,221,221,1)" stroke-width="1"/>
    </pattern>
    <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
      <rect width="100" height="100" fill="url(#small-grid)"/>
      <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(221,221,221,1)" stroke-width="2"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#grid)" />
</svg>

<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <circle id="dot-tl" cx="0" cy="0" r="2" fill="rgba(221,221,221,1)" />
    <circle id="dot-br" cx="20" cy="20" r="2" fill="rgba(221,221,221,1)" />
    <circle id="dot-bl" cx="0" cy="20" r="2" fill="rgba(221,221,221,1)" />
    <circle id="dot-tr" cx="20" cy="0" r="2" fill="rgba(221,221,221,1)" />
  </defs>
  <pattern id="dots-grid" patternUnits="userSpaceOnUse" width="20" height="20">
    <use xlink:href="#dot-tl" />
    <use xlink:href="#dot-tr" />
    <use xlink:href="#dot-bl" />
    <use xlink:href="#dot-br" />
  </pattern>
  <rect width="100%" height="100%" fill="url(#dots-grid)" />
</svg>

또 다른 흥미로운 구현은 `<line>`의 `stroke-dasharray`를 쓰는 방법입니다. 대량으로 반복되는 `<circle>`보다 SVG 요소 수가 적습니다. [Dot Grid With pattern]을 참고하세요.

그런 다음 그리드를 그리는 로직에 판정을 추가합니다. 스크린샷 모드가 아닐 때는 그대로 두고, 스크린샷 모드에서는 그리드 포함 옵션이 켜져 있을 때만 그립니다.

```ts
hooks.beginFrame.tap(() => {
    if (
        !this.#enableCapture ||
        (this.#enableCapture && this.#captureOptions.grid)
    ) {
        this.#grid.render(this.#device, this.#renderPass, this.#uniformBuffer);
    }
});
```

#### viewBox로 카메라 매개변수 반영하기 {#use-viewbox}

캔버스의 너비와 높이는 `<svg>` 요소에 둘 수 있습니다. 그렇다면 이동 `x/y`와 `zoom` 같은 카메라 변환 매개변수(카메라 회전 내보내기는 아직 지원하지 않습니다)는 결과 SVG 요소에 어떻게 반영해야 할까요?

여기서는 [viewBox]를 사용할 수 있습니다.

```ts
const { x, y, rotation, zoom } = cameras[0].read(ComputedCamera);
$namespace.setAttribute(
    'viewBox',
    `${x} ${y} ${width / zoom} ${height / zoom}`,
);
```

#### SVG 최적화 {#svg-optimizer}

현재 SVG 결과물을 자세히 보면 `opacity=“1”`처럼 불필요한 속성이 있습니다. 이것은 기본값이라 결과물에 명시할 필요가 없습니다. 사실 이것은 [svgo] 같은 SVG 최적화 도구가 쓰는 수단 중 하나입니다.

> SVG files, especially those exported from vector editors, usually contain a lot of redundant information. This includes editor metadata, comments, hidden elements, **default or suboptimal values**, and other stuff that can be safely removed or converted without impacting rendering.

그래서 기본 속성값 매핑 표를 유지해야 합니다. 속성값이 기본값과 같으면 `setAttribute`로 설정할 필요가 없습니다.

```ts
const defaultValues = {
    opacity: 1,
    fillOpacity: 1,
    strokeOpacity: 1,
    fill: 'black',
    stroke: 'none',
};

Object.entries(rest).forEach(([key, value]) => {
    if (`${value}` !== '' && `${defaultValues[key]}` !== `${value}`) {
        element.setAttribute(camelToKebabCase(key), `${value}`);
    }
});
```

#### [WIP] 인라인 Web 폰트 {#inlined-web-font}

SVG로 내보낼 때 웹 폰트를 사용했다면 파일 안에 인라인하는 것을 목표로 합니다. 물론 폰트 파일 크기 제약 때문에 런타임에 필요에 따라 일부를 잘라 내야 합니다. 아래는 Excalidraw의 처리 흐름이며, 자세한 내용은 [Font subsetting in excalidraw]에 있습니다.

![출처: https://link.excalidraw.com/readonly/MbbnWPSWXgadXdtmzgeO](https://github.com/user-attachments/assets/e255df0a-13de-4cb6-ae2e-9e885b643c63)

### GIF 내보내기 {#to-gif}

이후 [Lesson 30 - Time-based animation]에서 후처리와 시간 유니폼으로 구동되는 효과를 다룹니다. 그 움직임을 **내보내려면** GIF나 WebM 같은 형식이 필요합니다. 여기서는 전자의 개요를 설명합니다.

1. 렌더링 경로는 현재 **프레임 인덱스**(또는 엔진 시간)를 받아, 각 단계가 효과의 올바른 순간을 보여 주어야 합니다.
2. **캔버스를 래스터로 스냅샷**합니다. 예를 들어 PNG이며, 이전 절에서 이미 다루었습니다.
3. **픽셀을 읽고 양자화**하여 팔레트로 만듭니다(예: 프레임당 256색). 품질을 조금 양보할 수 있다면 128색이나 64색으로도 파일 크기가 보통 크게 줄어듭니다. 그라디언트와 사진에 가까운 내용은 밴딩이나 노이즈가 더 드러납니다.
4. **프레임별 팔레트:** 단순한 방법은 프레임마다 `quantize`를 한 번 하고 `writeFrame`마다 `palette`를 하나 두는 것이며, 플랫 UI에 잘 맞습니다. 프레임 사이 변화가 적은 짧은 루프라면 **전역 팔레트 하나**나 **더 적은 키프레임**이 공간을 더 아낄 수 있지만, 구현 비용은 눈에 띄게 높아집니다.

```ts
import { GIFEncoder, applyPalette, quantize } from 'gifenc';

const gif = GIFEncoder();
for (let i = 0; i < frameCount; i++) {
    renderFrame(i); // (1) drive time / frame
    await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
    );
    const dataUrl = el.toDataURL('image/png', pngQuality); // (2) raster snapshot
    const imageData = await imageDataFromPngDataUrl(dataUrl, w, h, ctx!);
    const palette = quantize(imageData.data, 256); // (3) build palette
    const index = applyPalette(imageData.data, palette); // (4) map to indices
    gif.writeFrame(index, w, h, { palette, delay });
}
gif.finish();
return new Blob([new Uint8Array(gif.bytes())], { type: 'image/gif' });
```

ECS는 각 프레임을 렌더한 뒤 브라우저 프레임 콜백을 기다렸다가 PNG 스냅샷을 읽으며, GIF와 WebM 내보내기 동안 캔버스 크기가 고정되어 있어야 합니다. 빈 캔버스, 크기 변경, PNG 디코드 오류, 그리기 예외가 있으면 빈 파일이나 부분 애니메이션을 반환하지 않고 내보내기를 거부합니다. 임시 캔버스는 성공과 실패 모두에서 해제됩니다. WebM은 레코더와 모든 캡처 트랙을 멈추고, 대기 중인 프레임 콜백을 취소하며, 이미지 핸들러를 분리하여 실패한 내보내기를 다시 시도할 수 있게 합니다. 호출자의 원본 캔버스는 그대로 사용할 수 있습니다.

WebM 타임스탬프는 여전히 실시간 `MediaRecorder` 캡처 시계를 따릅니다. 선택한 FPS는 효과 시간을 진행시키지만, WebM의 정확한 프레임 레이트나 길이를 보장하지는 않습니다. GIF는 프레임별 지연을 기록하며, 단위는 10밀리초입니다. 브라우저는 짧은 표시 시간을 더 제한할 수도 있습니다.

### PDF 내보내기 {#to-pdf}

픽셀과 벡터를 모두 쓸 수 있게 되었으니, 그래도 PDF로 내보내고 싶다면 이미지를 추가하는 API를 제공하는 [jsPDF]를 사용할 수 있습니다. 지면 관계상 여기서는 다루지 않습니다.

다른 주제인, 캔버스에서 이미지를 렌더링하는 방법을 살펴보겠습니다.

## 이미지 렌더링 {#render-image}

WebGL / WebGPU에서는 이미지를 불러와 텍스처로 쓰는 일이 많습니다. 서로 다른 종류의 리소스를 불러오는 일은 복잡한 비동기 과정이므로, 대부분의 렌더링 엔진은 리소스 로더를 제공합니다. 여러 종류의 이미지 외에 오디오, JSON, glTF 같은 다른 데이터 형식도 지원하는 경우가 많습니다. 아래는 [PIXI Assets] 사용 예입니다.

```ts
import { Sprite, Assets } from 'pixi.js';
// load the texture we need
const texture = await Assets.load('bunny.png');

// This creates a texture from a 'bunny.png' image
const bunny = new Sprite(texture);
```

그렇다면 리소스 로더를 어떻게 구현할까요?

### 이미지 로더 {#image-loader}

[loaders.gl]은 리소스 종류별로 여러 로더를 제공합니다. 예를 들면 다음과 같습니다.

-   시각화 애플리케이션에서 자주 쓰는 JSON, CSV, GeoJSON, GeoTiles 등
-   glTF 같은 3D 모델 형식
-   다양한 압축 텍스처 형식. [CompressedTextureLoader]로 WebWorker에서 불러와 파싱합니다.

이러한 로더는 상위 애플리케이션 개발에 큰 편의를 제공합니다. [ImageLoader]를 직접 사용할 수 있으며, PNG, JPEG, GIF, WEBP, AVIF, BMP, SVG 등의 이미지 형식을 지원합니다. `@loaders.gl/core`는 API 호출의 일관성과 서로 다른 종류의 로더에 대한 확장성을 보장합니다.

```ts
import { ImageLoader } from '@loaders.gl/images';
import { load } from '@loaders.gl/core';

const image = await load(url, ImageLoader, options);
```

`fill` 속성을 직접 설정하는 것 외에도, 역직렬화할 때 DataURL을 Image 객체로 복원해야 합니다.

```ts
async function deserializeNode(data: SerializedNode) {
    // data:image/png:base64...
    if (fill && isString(fill) && isDataUrl(fill)) {
        shape.fill = (await load(fill, ImageLoader)) as ImageBitmap;
    }
}
```

### API 설계 {#image-api}

API 설계로 돌아가면, Circle / Ellipse / Rect를 본떠 이미지용 도형을 새로 추가할 수도 있습니다. 이것은 SVG의 [\<image\>]에 대응합니다.

```ts
const image = new Image({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    src: 'data:image...',
});
```

하지만 생각해 보면 Image는 스트로크, 둥근 모서리, 그림자 등 Rect의 모든 능력을 가져야 합니다. 흥미롭게도 Figma에서 1920 \* 1920 이미지를 캔버스에 넣고 SVG로 내보내면 다음과 같은 구조의 `<rect>` 요소가 나옵니다(일부 속성값은 생략). `fill` 속성은 [\<pattern\>]을 참조하며, 이는 간접적으로 이미지 타일 채우기를 사용합니다.

```html
<svg>
    <rect width="500" height="500" fill="url(#pattern0_2442_3)" />
    <defs>
        <pattern id="pattern0_2442_3">
            <use xlink:href="#image0_2442_3"
            <!-- 0.000520833 = 1 / 1920 -->
            transform="matrix(0.000520833 0 0 0.000527058 0 -0.0059761)" />
        </pattern>
        <image
            id="image0_2442_3"
            width="1920"
            height="1920"
            xlink:href="data:image/png;base64,iVBO..."
        />
    </defs>
</svg>
```

여기서 힌트를 얻을 수 있습니다. 이미지는 별도의 도형으로 존재할 필요가 없고, 다른 도형의 `fill` 속성이 매핑을 지원하기만 하면 Circle / Rect 등이 이미지를 채우기로 쓸 수 있습니다. 스트로크가 있는 원형 아이콘을 구현한다고 상상해 보세요. 원래 설계라면 [\<clipPath\>] 같은 것이 있는 Image 도형이 필요하지만, 이제는 기존 Circle 도형을 이미지로 채우면 됩니다.

```ts
circle.fill = image;
circle.stroke = 'black';
```

### 구현 {#implementation}

그래서 첫 단계로 `fill`이 지원하는 타입을 색 문자열에서 더 많은 텍스처 소스로 확장합니다.

```ts
export interface IRenderable {
    fill: string; // [!code --]
    fill: string | TexImageSource; // [!code ++]
}

type TexImageSource =
    | ImageBitmap
    | ImageData
    | HTMLImageElement
    | HTMLCanvasElement
    | HTMLVideoElement
    | OffscreenCanvas
    | VideoFrame;
```

정점 데이터에 텍스처 사용 여부를 나타내는 필드가 필요하며, 사용하는 경우 텍스처를 샘플링합니다. `SAMPLER_2D()`는 표준 GLSL 문법이 아니라, 셰이더 컴파일 단계에서 GLSL100 / GLSL300 / WGSL 샘플링 문법으로 바꾸기 위한 자체 표식입니다. 또한 현재 텍스처는 업로드된 이미지이며, [createLinearGradient] 같은 Canvas2D API로 만든 그라디언트는 나중에 지원합니다.

```glsl
// vert
out vec2 v_Uv;
v_Uv = (a_FragCoord * radius / size + 1.0) / 2.0;

// frag
in vec2 v_Uv;
uniform sampler2D u_Texture;

if (useFillImage) {
    fillColor = texture(SAMPLER_2D(u_Texture), v_Uv);
}
```

`uniform`을 쓰면 기존의 배치 렌더링 로직이 깨집니다. [Inside PixiJS: Batch Rendering System]은 Pixi.js의 BatchRenderer 구현 로직을 설명합니다. 아래의 런타임 컴파일 셰이더 템플릿에서 보듯, 동시에 지원할 수 있는 샘플러의 최대 개수는 `%count%`개의 샘플러 집합이며, 각 인스턴스는 정점 데이터 `aTextureId`로 그 집합에서 샘플러를 고릅니다.

```glsl
// Shader template in Pixi.js BatchRenderer
// vert
attribute int aTextureId;
varying int vTextureId;
vTextureId = aTextureId;

// frag
uniform sampler2D uSamplers[%count%];
varying int vTextureId;
```

단순하게, 병합 로직을 다음과 같이 줄입니다.

1. 색 문자열인 `fill`은 Image와 합칠 수 없습니다.
2. 서로 다른 Image 값인 `fill`은 합칠 수 없습니다.

따라서 다음 세 원은 같은 배치에서 그려집니다.

```js eval code=false
$icCanvas3 = call(() => {
    return document.createElement('ic-canvas-lesson10');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson10;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas3.parentElement.style.position = 'relative';
    $icCanvas3.parentElement.appendChild($stats);

    $icCanvas3.addEventListener('ic-ready', async (e) => {
        const image = await Utils.loadImage('/canvas.png');

        const canvas = e.detail;

        const circle1 = new Circle({
            cx: 200,
            cy: 200,
            r: 50,
            fill: image,
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
            strokeAlignment: 'inner',
        });
        canvas.appendChild(circle1);

        const circle2 = new Circle({
            cx: 320,
            cy: 200,
            r: 50,
            fill: image,
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
        });
        canvas.appendChild(circle2);

        const circle3 = new Circle({
            cx: 460,
            cy: 200,
            r: 50,
            fill: image,
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
            strokeAlignment: 'outer',
        });
        canvas.appendChild(circle3);
    });

    $icCanvas3.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

### 렌더 캐시 {#render-cache}

이전에는 Program, Bindings, Sampler 같은 GPU 객체의 캐시를 고려하지 않았습니다. 이를 위해 리소스 캐시 관리자를 추가하여 재사용할 수 있게 하고, 리소스 종류에 따라 히트 로직을 구현합니다. Sampler를 예로 들면, `SamplerDescriptor`의 속성이 모두 같으면 캐시에 히트하며, 비교 로직은 `samplerDescriptorEquals`에 있습니다.

```ts
import { samplerDescriptorEquals } from '@antv/g-device-api';

export class RenderCache {
    device: Device;
    private samplerCache = new HashMap<SamplerDescriptor, Sampler>(
        samplerDescriptorEquals,
        nullHashFunc,
    );

    createSampler(descriptor: SamplerDescriptor): Sampler {
        // 优先从缓存中取
        let sampler = this.samplerCache.get(descriptor);
        if (sampler === null) {
            // 未命中，创建并添加缓存
            sampler = this.device.createSampler(descriptor);
            this.samplerCache.add(descriptor, sampler);
        }
        return sampler;
    }
}
```

### 오브젝트 맞춤 (object-fit) {#object-fit}

사각형의 지오메트리는 이미지의 고유 종횡비와 일치하지 않는 경우가 많습니다. 어디서나 `drawImage(0, 0, width, height)`로 그리면 아이콘과 사진이 늘어납니다. 디자인 도구는 보통 맞춤 / 채우기 / 자르기 모드를 제공하며, 우리는 `type: 'image'`인 `FillLayers` 항목에 CSS [object-fit]과 [object-position]을 따릅니다.

```ts
fills: [
    {
        type: 'image',
        value: '/canvas.png',
        objectFit: 'contain',
        objectPosition: 'top left',
    },
];
```

| `objectFit`           | 동작                                                                          |
| --------------------- | ----------------------------------------------------------------------------- |
| `fill`                | 지오메트리를 채우도록 늘입니다(**기본값**, 초기의 래스터 동작과 같습니다)     |
| `contain`             | 균일하게 확대·축소하여 이미지 전체를 보여 줍니다. 레터박스가 생길 수 있습니다 |
| `cover`               | 균일하게 확대·축소하여 지오메트리를 채웁니다. 넘치는 부분은 자릅니다          |
| `none` / `scale-down` | CSS와 같은 의미입니다                                                         |

Figma 이미지 스케일링과 Pencil `mode`(`stretch` / `fill` / `fit`)에 어떻게 대응되는지는 [오브젝트 맞춤 예제](/example/object-fit)를 참고하세요.

CPU에서는 이미지를 텍스처로 래스터화합니다. `objectFit`으로 그릴 사각형을 계산해 캔버스에 칠합니다. `contain` / `cover`의 텍스처 크기는 `max(source width, geometry width)`가 아니라 **지오메트리 × 디바이스 픽셀 비율**입니다. 그렇지 않으면 이미지 전체가 비트맵을 채우고, 도형에 매핑했을 때 여전히 늘어진 `fill`처럼 보입니다.

<ObjectFit />

### iOS Live Photo {#ios-live-photo}

파일 수준에서 iOS Live Photo는 보통 HEIC 정지 이미지와 함께 있는 MOV입니다. 브라우저마다 네이티브 HEIC 지원이 다르며, ECS 이미지 로더는 heic-to로 변환 경로를 제공합니다.

일반 이미지처럼 다루고자 합니다. 정지 프레임 하나를 비트맵으로 디코드한 뒤 텍스처에 업로드합니다. 캔버스에서 Live Photo에 포함된 영상을 재생하는 것은 후속 작업이며, 탭하여 재생하는 전용 컴포넌트 등을 따로 만듭니다.

`loadImageBitmapUniversal`은 URL, Blob 또는 File을 받습니다. MIME, 파일 확장자 또는 파일 시그니처로 HEIC/HEIF를 인식하고, 필요할 때만 heic-to를 불러오므로 SSR 중에 모듈을 불러와도 안전합니다. 첫 정지 프레임을 PNG로 변환하고, 변환이나 비트맵 디코딩이 실패하면 JPEG로 한 번 재시도합니다. HEIC가 아닌 이미지는 계속해서 loaders.gl로 처리합니다.

HTTP 오류는 변환 전에 거부됩니다. 일반 이미지 디코드가 실패하고 진단용 HEIC 프로브도 실패하면 원래 오류를 유지합니다. 각 호출은 독립적으로 재시도할 수 있습니다. 반환된 비트맵은 호출자 소유이며 사용 후 닫아야 합니다. 입력으로 넘긴 객체 URL도 호출자가 소유합니다.

```ts
import { loadImageBitmapUniversal } from '@infinite-canvas-tutorial/ecs';

async function drawStill(
    context: CanvasRenderingContext2D,
    source: string | Blob,
) {
    const bitmap = await loadImageBitmapUniversal(source);
    try {
        context.drawImage(bitmap, 0, 0);
    } finally {
        bitmap.close?.();
    }
}
```

디코더는 heic-to 1.6.6(libheif 1.23.6)을 사용하며, 이전 디코더가 풀레인지 SDR 픽스처에서 일으키던 색 이동과 투명도 손실을 바로잡습니다. 브라우저 회귀는 원본 색과 비교하고, 회색 단계, PNG 투명도, 다중 이미지 컨테이너의 첫 정지 프레임, 동시 디코딩, 손상된 입력 이후의 복구를 다룹니다.
JPEG 폴백은 여전히 손실이 있으며 알파를 보존할 수 없습니다. 이 검사는 임의의 ICC 프로파일, 와이드 가멋 색, HDR, Live Photo 영상 재생은 다루지 않습니다.

## SVG 확장: 스트로크 정렬 {#stroke-alignment}

마지막으로 흥미로운 주제를 소개합니다. 현재 SVG 명세가 지원하지 않는 기능을 구현할 수 있습니다.

먼저 SVG에서 `opacity`, `stroke-opacity`, `fill-opacity`의 차이부터 보겠습니다. 왼쪽 원은 `opacity=“0.5”`이고 오른쪽 원은 `fill-opacity=“0.5” stroke-opacity=“0.5”`입니다. 스트로크의 절반은 원 안쪽에, 절반은 원 바깥쪽에 있는 것을 볼 수 있습니다.

<svg viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" fill="red" stroke="black" stroke-width="20" opacity="0.5" />
  <circle cx="150" cy="50" r="40" fill="red" stroke="black" stroke-width="20" fill-opacity="0.5" stroke-opacity="0.5" />
</svg>

Figma에서 대응하는 Stroke 위치는 `Center`이며, 다른 옵션으로 `Inside`와 `Outside`가 있습니다. 각각은 아래에 나와 있습니다. SVG에서는 이것을 `stroke-alignment`라고 하지만 현재 초안 단계입니다. [Specifying stroke alignment]를 참고하세요. Pixi.js도 WebGL 모드에서 [PIXI.LineStyle alignment]를 제공합니다.

![Figma의 스트로크 정렬](/figma-stroke-align.png)

모든 도형에 `strokeAlignment` 속성을 추가합니다.

```ts
export interface IRenderable {
    strokeAlignment: 'center' | 'inner' | 'outer'; // [!code ++]
}
```

### 셰이더에서의 스트로크 정렬 {#stroke-alignment-rendering}

셰이더 쪽 구현은 이 세 값을 구분하고 채우기와 스트로크 색을 서로 다른 방식으로 섞기만 하면 됩니다.

```glsl
if (strokeAlignment < 0.5) { // center
    d1 = distance + strokeWidth;
    d2 = distance + strokeWidth / 2.0;
    color = mix_border_inside(over(fillColor, strokeColor), fillColor, d1);
    color = mix_border_inside(strokeColor, color, d2);
} else if (strokeAlignment < 1.5) { // inner
    d1 = distance + strokeWidth;
    d2 = distance;
    color = mix_border_inside(over(fillColor, strokeColor), fillColor, d1);
    color = mix_border_inside(strokeColor, color, d2);
} else if (strokeAlignment < 2.5) { // outer
    d2 = distance + strokeWidth;
    color = mix_border_inside(strokeColor, color, d2); // No need to use fillColor at all
}
```

아래가 우리 구현이며, 렌더링이 Figma와 일치하는 것을 볼 수 있습니다.

```js eval code=false
$icCanvas2 = call(() => {
    return document.createElement('ic-canvas-lesson10');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson10;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas2.parentElement.style.position = 'relative';
    $icCanvas2.parentElement.appendChild($stats);

    $icCanvas2.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        const circle1 = new Circle({
            cx: 200,
            cy: 200,
            r: 50,
            fill: '#F67676',
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
            strokeAlignment: 'inner',
        });
        canvas.appendChild(circle1);

        const circle2 = new Circle({
            cx: 320,
            cy: 200,
            r: 50,
            fill: '#F67676',
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
        });
        canvas.appendChild(circle2);

        const circle3 = new Circle({
            cx: 460,
            cy: 200,
            r: 50,
            fill: '#F67676',
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
            strokeAlignment: 'outer',
        });
        canvas.appendChild(circle3);
    });

    $icCanvas2.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

렌더링 바운딩 박스와 피킹 판정을 계산할 때도 이 속성을 고려해야 합니다. 아래 함수는 값에 따라 스트로크가 도형 자체에서 바깥으로 얼마나 뻗어야 하는지를 나타냅니다.

```ts
function strokeOffset(
    strokeAlignment: 'center' | 'inner' | 'outer',
    strokeWidth: number,
) {
    if (strokeAlignment === 'center') {
        return strokeWidth / 2;
    } else if (strokeAlignment === 'inner') {
        return 0;
    } else if (strokeAlignment === 'outer') {
        return strokeWidth;
    }
}
```

### SVG 내보내기 {#stroke-alignment-export-svg}

앞에서 말했듯 SVG는 아직 `stroke-alignment`를 지원하지 않으므로, 지금은 편법으로만 흉내 낼 수 있습니다. 그림이 단순하면 채우기와 스트로크를 두 번에 나누어 그릴 수 있습니다. 아래는 Figma가 `stroke-alignment: 'inner'`를 내보낸 결과이며, 같은 방식을 사용합니다.

```html
<circle cx="200" cy="200" r="200" fill="#F67676" />
<circle
    cx="200"
    cy="200"
    r="160"
    stroke="black"
    stroke-opacity="0.5"
    stroke-width="100"
/>
```

<div style="display:flex;justify-content:center;align-items:center;">
    <svg width="100" height="100" viewBox="0 0 443 443" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="221.5" cy="221.5" r="221.5" fill="#F67676"/>
    <circle cx="221.5" cy="221.5" r="171.5" stroke="black" stroke-opacity="0.5" stroke-width="100"/>
    </svg>
    <svg width="120" height="120" viewBox="0 0 643 643" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="321.5" cy="321.5" r="221.5" fill="#F67676"/>
    <circle cx="321.5" cy="321.5" r="271.5" stroke="black" stroke-opacity="0.5" stroke-width="100"/>
    </svg>
</div>

이 외에도 Figma 문서 [StrokeAlign in Figma widget]은 비슷한 요소를 두 개 만들지 않는 다른 아이디어를 제시합니다. [How to simulate stroke-align (stroke-alignment) in SVG]는 스트로크 너비를 원래의 두 배로 늘리고 clipPath와 mask로 넘치는 부분을 제거하는 방식으로 이 아이디어를 시도합니다.

> Inside and outside stroke are actually implemented by doubling the stroke weight and masking the stroke by the fill. This means inside-aligned stroke will never draw strokes outside the fill and outside-aligned stroke will never draw strokes inside the fill.

구현을 단순하게 하기 위해 첫 번째 방식을 선택합니다. 비슷한 요소를 두 개 만들어 채우기와 스트로크를 각각 그리며, 위 예에서 SVG 내보내기를 시도해 볼 수 있습니다.

캔버스 기능이 풍부해지면, 가져오기와 내보내기가 제대로 동작하는지, 렌더링이 올바른지, UI 컴포넌트가 상호작용하는지를 검증하는 테스트를 도입해야 합니다. 다음 절에서 소개합니다.

## 더 읽어보기 {#extended-reading}

-   [Export from Figma]
-   [Specifying stroke alignment]
-   [How to simulate stroke-align (stroke-alignment) in SVG]
-   [Vector rendering of SVG content with PixiJS]

[Export from Figma]: https://help.figma.com/hc/en-us/articles/360040028114-Export-from-Figma#h_01GWB002EPWMFSXKAEC62GS605
[How to simulate stroke-align (stroke-alignment) in SVG]: https://stackoverflow.com/questions/74958705/how-to-simulate-stroke-align-stroke-alignment-in-svg
[HTMLCanvasElement.toDataURL()]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL
[preserveDrawingBuffer]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext#preservedrawingbuffer
[DataURI]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs
[SwapChain]: /ko/guide/lesson-001#swapchain
[Web UI with Lit and Shoelace]: /ko/guide/lesson-007
[Plugin-based architecture]: /ko/guide/lesson-001#plugin-based-architecture
[SVGRenderer]: https://threejs.org/docs/#examples/en/renderers/SVGRenderer
[toJSON]: https://threejs.org/docs/#api/en/core/Object3D.toJSON
[JSON-Object-Scene-format-4]: https://github.com/mrdoob/three.js/wiki/JSON-Object-Scene-format-4
[Grid]: /ko/guide/lesson-005
[SVG Element]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element
[\<svg\>]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/svg
[setAttribute]: https://developer.mozilla.org/en-US/docs/Web/API/Element/setAttribute
[jsPDF]: https://github.com/parallax/jsPDF
[loaders.gl]: https://github.com/visgl/loaders.gl
[ImageLoader]: https://loaders.gl/docs/modules/images/api-reference/image-loader
[CompressedTextureLoader]: https://loaders.gl/docs/modules/textures/api-reference/compressed-texture-loader
[PIXI Assets]: https://pixijs.download/release/docs/assets.html
[Specifying stroke alignment]: https://www.w3.org/TR/svg-strokes/#SpecifyingStrokeAlignment
[StrokeAlign in Figma widget]: https://www.figma.com/widget-docs/api/component-SVG/#strokealign
[How to draw grid using HTML5 and canvas or SVG]: https://stackoverflow.com/questions/14208673/how-to-draw-grid-using-html5-and-canvas-or-svg
[Convert ImageBitmap to Blob]: https://stackoverflow.com/questions/52959839/convert-imagebitmap-to-blob
[ImageBitmapRenderingContext]: https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmapRenderingContext
[@pixi-essentials/svg]: https://github.com/ShukantPal/pixi-essentials/tree/master/packages/svg
[Vector rendering of SVG content with PixiJS]: https://medium.com/javascript-in-plain-english/vector-rendering-of-svg-content-with-pixijs-6f26c91f09ee
[svgo]: https://github.com/svg/svgo
[Dot Grid With pattern]: https://www.smashingmagazine.com/2024/09/svg-coding-examples-recipes-writing-vectors-by-hand/#dot-grid-with-pattern
[Adding Shadows to SVG Icons With CSS and SVG Filters]: https://css-tricks.com/adding-shadows-to-svg-icons-with-css-and-svg-filters/
[filter primitive]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element#filter_primitive_elements
[JSON objects in tldraw]: https://tldraw.dev/docs/shapes#The-shape-object
[JSON schema in excalidraw]: https://docs.excalidraw.com/docs/codebase/json-schema
[viewBox]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/viewBox
[Font subsetting in excalidraw]: https://github.com/excalidraw/excalidraw/issues/1972#issuecomment-2417744618
[Lesson 30 - Time-based animation]: /ko/guide/lesson-030#time-animation
