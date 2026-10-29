---
outline: deep
description: 'Pencil의 디자인 토큰, 변수, 테마, 컴포넌트화된 생성, 아이콘 폰트 통합을 다룹니다. SVG와 Iconify 내보내기, 그리고 디자인에서 코드로 가는 경로를 설명합니다.'
head:
    - ['meta', { property: 'og:title', content: '38강 - 디자인에서 코드로' }]
---

<script setup>
import IconLucide from '../../components/IconLucide.vue'
import IconButton from '../../components/IconButton.vue'
import ComponentsInstances from '../../components/ComponentsInstances.vue'
import DesignToCodeInterfaces from '../../components/DesignToCodeInterfaces.vue'
</script>

# 38강 - 디자인에서 코드로 {#lesson-38-from-design-to-code}

## 변수와 테마 {#variables-and-themes}

Pencil은 다중 테마의 조건부 값을 갖춘 완전한 디자인 토큰 시스템을 지원합니다. 자세한 내용은 [Variables and Themes]를 참고하세요. 변수는 하드코딩을 줄입니다. AI 모델은 구체적인 색 값을 출력할 필요가 없고(`#RRGGBB` 실수가 줄어듭니다), 디자인 시스템의 토큰 표를 익힐 필요도 없습니다. 시맨틱 변수 이름만 있으면 되며, 렌더러가 그 값을 해석합니다.

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

AI 모델이 다크 모드용으로 디자인할 때는 팔레트 두 벌 전체가 필요하지 않습니다. `$color.bg` 같은 참조만 있으면 되고, 노드의 `theme`가 해석된 값을 결정합니다.

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

AI 모델은 픽셀 값을 계산하거나 반응형 브레이크포인트를 연결할 필요도 없습니다. 의도를 선언적으로 밝히면 레이아웃 엔진이 지오메트리를 계산합니다. 자세한 내용은 [33강 - 레이아웃 엔진][Lesson 33 - Layout engine]을 참고하세요.

### 변수 타입 {#variable-types}

Figma는 네 가지 변수 종류를 지원합니다. 자세한 내용은 [Guide to variables in Figma]를 참고하세요.

-   색 (`#000000`)
-   숫자
-   문자열. 예: `fontFamily` 또는 텍스트 내용
-   불리언

![출처: https://help.figma.com/hc/en-us/articles/14506821864087-Overview-of-variables-collections-and-modes](https://help.figma.com/hc/article_attachments/30211233510039)

![출처: https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections](https://help.figma.com/hc/article_attachments/26964398869143)

### 속성 패널과 변수 선택기 {#property-panel-and-variable-picker}

노드를 선택한 상태에서 Spectrum 속성 패널은 `AppState.variables`의 디자인 변수를 **채우기 / 스트로크 색 / 스트로크 너비 / 글자 크기**에 묶을 수 있습니다. 드롭다운에서 이름을 고르면 `$token`이 기록됩니다. 묶이면 보라색 배지가 나타나고, 한 번의 동작으로 **바인딩 해제**할 수 있습니다(현재 해석된 리터럴을 다시 쓰고 히스토리에 기록합니다). 색 선택기와 스트로크 너비 슬라이더는 항상 **해석된** 값을 보여 주므로, 그대로의 `$...`가 잘못된 CSS 색으로 쓰이지 않습니다.

### SVG 내보내기 {#export-svg}

내보내기 전략은 여러 가지이며, 기본값은 해석된 리터럴입니다.

```ts
export type DesignVariablesSvgExportMode =
    /** Resolve $ → literal */
    | 'resolved'
    /** Keep `$token` strings (attributes may be non-standard; good for post-processing) */
    | 'preserve-token'
    /** `:root{--x:...}` + `fill="var(--x)"` */
    | 'css-var';
```

CSS 변수 모드도 사용할 수 있습니다. 전역 값은 `:root` 아래에 선언되므로 개발자 도구에서 조정할 수 있습니다. 자세한 내용은 [Using CSS custom properties (variables)]를 참고하세요.

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

## 아이콘 {#icon}

아이콘은 UI를 생성할 때 중요합니다. [Lucide]는 이미 React 코드 생성에서 널리 쓰이며, Pencil도 이와 비슷한 내장 그래픽을 지원합니다.

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

OpenPencil에서 `iconLookup`은 주입할 수 있는 함수입니다. 이는 다음을 뜻합니다.

-   **유연성**: 어떤 아이콘 소스든 사용할 수 있습니다(Iconify, Lucide, 사용자 지정).
-   **모델 부담**: AI 모델은 `iconFontName: "SearchIcon"`만 출력합니다. 경로는 런타임이 해석합니다.

```ts
private drawIconFont(canvas, node, x, y, w, h, opacity) {
  const iconName = iNode.iconFontName ?? iNode.name ?? '';
  const iconMatch = this.iconLookup?.(iconName) ?? null;
  const iconD = iconMatch?.d ?? FALLBACK_ICON_D;  // SVG path data
  const iconStyle = iconMatch?.style ?? 'stroke';   // stroke or fill

  // Resolve SVG path → Skia path → scale → draw
}
```

우리의 정의는 다음과 같습니다.

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

### 런타임에 아이콘 등록 {#register-icon-at-runtime}

[IconifyJSON]의 아이콘 형식을 사용하여, SVG가 들어 있는 JSON으로 Lucide, Material 등의 세트를 런타임에 불러옵니다.

```ts
import { registerIconifyIconSet } from '@infinite-canvas-tutorial/ecs';

const m = await import('@iconify/json/json/lucide.json');
registerIconifyIconSet('lucide', m);
```

아이콘 본문은 작은따옴표 또는 큰따옴표로 된 SVG 속성을 받습니다. 패스, 사각형, 원, 타원, 선은 자기 닫는 태그 또는 명시적 닫는 태그를 쓸 수 있습니다. 중첩된 `<g>`의 채우기와 스트로크 속성은 그 안의 도형이 상속합니다.

아이콘 JSON은 이전과 같은 방식으로 씬 그래프에 매핑됩니다. Search 아이콘은 `Group`이 되고, 자식으로 `Path`와 `Circle`을 가지며, SVG를 우리 도형으로 바꾸는 것과 매우 비슷합니다.

```json
"search": {
    "body": "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"m21 21l-4.34-4.34\"/><circle cx=\"11\" cy=\"11\" r=\"8\"/></g>"
}
```

너비, 높이, `strokeWidth`도 변환된 그래프에 매핑합니다.

```ts
function buildIconFontScalablePrimitives(
    iconFontName: string,
    iconFontFamily: string,
    targetWidth: number,
    targetHeight: number,
): ScaledIconPrimitive[] {}
```

<IconLucide />

### 레이어 패널에 표시 {#display-in-the-layer-panel}

Iconify는 표시용 Web Components를 제공합니다. 자세한 내용은 [Iconify Icon web component]를 참고하세요. 레이어 목록의 썸네일에 이를 사용합니다.

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

### SVG 내보내기 {#export-icon-to-svg}

### 레이아웃과 함께 렌더링 {#render-component-with-layout}

[33강 - 레이아웃 엔진][Lesson 33 - Layout engine]과 함께 쓰면, 아이콘이 포함된 버튼을 만들 수 있습니다.

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

[Shadcn UI]와 같은 취지로, 여러 **배리언트**를 가진 `Button`을 원합니다. 같은 구조를 반복해서 쓰지 않기 위해서입니다.

```tsx
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Destructive</Button>
```

## 컴포넌트와 슬롯 {#components-and-slots}

`.pen` 파일의 `ref` + `descendants` 시스템은, 사실상 AI를 위한 컴포넌트 상속 모델입니다. AI 모델은 저수준 구성(둥근 사각형 + 텍스트 + 패딩)을 이해할 필요가 없습니다. 디자인 시스템에 있는 `round-button`을 가리키고 레이블을 덮어쓰면 됩니다. 이는 코드에서 “상속한 다음 덮어쓰기”와 같은 발상입니다. 자세한 내용은 [Components and Instances]를 참고하세요.

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

## 디자인 ↔ 코드 {#design-to-code}

[Design ↔ Code]

[Design ↔ Code]의 핵심 통찰은, design-to-code가 픽셀을 코드로 옮기는 AI의 추측이 **아니라는** 점입니다. `.ic` 형식은 이미 코드에 친화적인 기본 요소를 담고 있습니다. flex 레이아웃, 디자인 변수, `reusable`/`ref` 컴포넌트, 시맨틱 이름, 아이콘 폰트입니다. 그래서 씬 그래프 **그 자체**가 코드를 위해 만들어진 IR입니다. 핵심은 **결정적 트랜스파일러**이고, AI는 이름 짓기와 구조 정리 층에서만 돕습니다.

### 파이프라인 {#design-to-code-pipeline}

SVG 내보내기 파이프라인을 따르되, 프레임워크에 구애받지 않는 **Code IR**을 넣습니다. 그러면 새 대상 프레임워크를 더하는 일은 이미터를 하나 더 쓰는 일입니다.

```text
.ic SceneGraph
  → expandRefSerializedNodes   // reuse existing ref/reusable handling
  → CodeIR                     // element tree + structured style + token refs + component defs
  → Emitter                    // react-tailwind | html-css | ...
```

Code IR 노드가 유지하는 것은 **역할**(컨테이너 / 텍스트 / 아이콘 / 이미지 / 도형), **해석 전의 `$token` 참조**, 구조화된 **flex 스타일**, 그리고 `reusable`/`ref` **컴포넌트 관계**입니다.

### 진입점 {#design-to-code-entry}

`API.exportCode`는 `renderToSVG`와 대응합니다. 인자가 없으면 씬 전체를 트랜스파일하고, 노드를 넘기면 그 선택 영역을 트랜스파일합니다.

```ts
const code = api.exportCode(undefined, {
    framework: 'react-tailwind', // or 'html-css'
    variablesMode: 'css-var', // 'resolved' | 'preserve-token' | 'css-var'
    componentStructure: 'preserve', // 'preserve' | 'flatten'
});
```

순수 함수를 직접 호출할 수도 있습니다.

```ts
import { serializedNodesToCode } from '@infinite-canvas-tutorial/ecs';

const code = serializedNodesToCode(nodes, {
    framework: 'react-tailwind',
    variables,
});
```

### 개념 매핑 {#design-to-code-mapping}

캔버스 노드는 용도에 따라 레이아웃, 텍스트, 이미지 또는 SVG로 변환됩니다. `reusable`과 `ref`는 React 컴포넌트와 인스턴스가 되고, 변수는 선택한 모드로 내보냅니다. [전체 개념 매핑](/ko/guide/design-to-code-reference#concept-mapping)을 참고하세요.

### 변수 모드 {#design-to-code-variable-modes}

세 가지 변수 모드는 SVG 내보내기 의미와 같습니다.

-   `resolved` (기본값): `$token`을 리터럴로 해석합니다(예: `bg-[#FFFFFF]`).
-   `css-var`: 스타일에 `var(--token)`을 냅니다(예: `bg-[var(--color-bg)]`). HTML/CSS 내보내기에는 `:root { … }` 블록이 포함됩니다. React는 각 내보낸 컴포넌트로 정의를 한정하며, 단독으로 렌더되는 reusable 컴포넌트도 포함합니다. 중첩된 인스턴스는 부모 스코프를 공유하므로, 따로 내보낸 결과들이 같은 토큰에 서로 다른 값을 쓸 수 있습니다. CSS 사용자 지정 속성은 텍스트 노드를 바꿀 수 없으므로, 텍스트 내용 토큰은 현재 값으로 해석됩니다.
-   `preserve-token`: `$token`을 유지합니다(후처리를 위해 인라인 `style`로 보냅니다).

### 컴포넌트와 인스턴스 {#design-to-code-components}

기본값인 `componentStructure: 'preserve'`는 `reusable`을 React 컴포넌트로, `ref`를 인스턴스로 내보냅니다. 지원되는 텍스트, 스타일과 레이아웃 변경은 props가 되고, props로 표현할 수 없는 변경은 인스턴스를 펼쳐 화면을 보존합니다.

텍스트, 이미지, 채우기, Path, 클리핑과 블렌드 규칙은 [내보내기 상세](/ko/guide/design-to-code-reference)를 참고하세요.

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

`componentStructure: 'flatten'`은 폴백입니다. `expandRefSerializedNodes`로 모든 인스턴스를 컴포넌트 정의 없는 구체적인 DOM으로 펼칩니다. HTML/CSS 이미터는 HTML에 컴포넌트 개념이 없으므로 항상 평탄화합니다.

### 실제 인터페이스 예시 {#practical-interface-examples}

IC 편집기 캔버스에서 대시보드, 요금 페이지, 모바일 결제 화면을 편집하고 현재 캔버스에서 코드를 생성·복사·다운로드할 수 있습니다. HTML/CSS를 선택한 뒤 **HTML preview**로 결과를 확인하세요. 요금 페이지에는 재사용 가능한 카드가 있습니다.

<DesignToCodeInterfaces />

`.ic`는 [온라인 앱](https://app.infinitecanvas.cc/)에서 다시 편집할 수 있고, HTML은 브라우저에서 열 수 있습니다. **Download React project** ZIP을 풀고 `pnpm install`, `pnpm dev`를 실행하세요. 생성된 코드는 화면 구성 부분이므로 탐색, 결제와 데이터는 앱에 연결해야 합니다. 자세한 내용은 [내보내기 상세](/ko/guide/design-to-code-reference#practical-interface-examples)를 참고하세요.

### 명령줄 {#cli}

저장소에는 `.ic` 파일용 오프라인 CLI도 포함되어 있습니다(Node.js 20 이상). 에디터에서 **Export as… > .ic**으로 디자인을 내보내고 `design.ic`로 저장하세요. 저장소 루트에서 워크스페이스 의존성을 순서대로 빌드한 다음 실행하세요.

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

`inspect --json`은 노드 수와 루트 수, reusable 노드, 변수, 에셋 URL 개수를 보고합니다. `--output`을 생략하면 생성된 코드가 표준 출력으로 나옵니다. 문서나 옵션이 잘못되면 오류 메시지와 함께 0이 아닌 종료 상태를 반환합니다. CLI는 에디터의 코드 생성기와 같은 React 컴포넌트 또는 HTML/CSS 조각을 출력합니다. 문서의 변수와 테마를 사용하고, 온라인 프로젝트에는 접근하지 않으며, 브라우저 밖에서는 유지될 수 없는 임시 `blob:` 이미지는 거부합니다. 내보낸 문서에서는 data URL이나 지속되는 이미지 URL을 사용하세요.

### 역방향: 코드 → 디자인 {#design-to-code-reverse}

역방향(JSX/HTML AST를 다시 `.ic` 노드로 파싱하는 일)은 더 어렵고 모호함도 더 크므로, 두 번째 단계로 남겨 둡니다. 권장하는 첫 이정표는, 임의의 손으로 작성한 코드로 넓히기 전에, 이 트랜스파일러가 내는 코드의 **멱등한 왕복**(디자인 → 코드 → 디자인, 정보 손실 없음)입니다.

## 더 읽어보기 {#extended-reading}

[Variables and Themes]: https://docs.pencil.dev/for-developers/the-pen-format#variables-and-themes
[Guide to variables in Figma]: https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma
[Using CSS custom properties (variables)]: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties
[Design ↔ Code]: https://docs.pencil.dev/design-and-code/design-to-code
[Lesson 33 - Layout engine]: /ko/guide/lesson-033
[IconifyJSON]: https://iconify.design/docs/types/iconify-json.html
[Iconify Icon web component]: https://iconify.design/docs/iconify-icon/
[Lucide]: https://lucide.dev/icons
[Shadcn UI]: https://ui.shadcn.com/docs/components/radix/button
[Components and Instances]: https://docs.pencil.dev/for-developers/the-pen-format#components-and-instances
