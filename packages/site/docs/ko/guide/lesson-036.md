---
outline: deep
description: '애니메이션 시스템을 구현합니다. 선언적 애니메이션 API 설계, Web Animations API 호환, 제너레이터 함수 기반 애니메이션 흐름, SVG 패스 애니메이션 기법을 다룹니다.'
head:
    - ['meta', { property: 'og:title', content: '36강 - 애니메이션' }]
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

# 36강 - 애니메이션 {#lesson-36-animation}

이번 강의에서는 다음 내용을 배웁니다.

-   애니메이션 API를 설계하는 방법
-   Web Animations API에 맞춘 선언적 키프레임과 컨트롤러를 구현하는 방법
-   패스, 스트로크, 모핑 효과를 구현하는 방법
-   Lottie 같은 형식이 이 구조에 어떻게 들어가는지

## 애니메이션 API를 설계하는 방법 {#api-design}

Motion은 선언적 WAAPI 스타일 애니메이션과 완전히 호환됩니다. [Improvements to Web Animations API]를 참고하세요. GPU 가속, 독립된 컴포지터 스레드, 메인 스레드 밖에서의 작업을 위해 브라우저 네이티브 `element.animate()`를 호출합니다. JavaScript은 WAAPI가 제공하지 않는 기능을 채웁니다.

-   스프링 물리(WAAPI는 베지에 이징만 지원합니다)
-   독립된 `transform` 속성(하나로 합친 transform 문자열이 아니라 `x`, `y`, `scale`을 따로 애니메이션합니다)
-   스케일과 회전의 중심을 위한 `transformOrigin`
-   `sequence()`, `stagger()` 같은 타임라인 헬퍼

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

키프레임과 옵션은 평범한 객체이며 JSON으로 직렬화할 수 있습니다. `animate()`의 런타임 상태, 즉 DOM 바인딩, 현재 시간, 속도 등은 직렬화할 수 없습니다.

## WAAPI를 따르기 {#waapi}

WAAPI 폴리필 [web-animations-js]를 따르고, 우리의 ECS와 통합할 수 있습니다.

**데이터 계층:** WAAPI와 비슷한 키프레임(직렬화 가능)

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

**제어 계층:** WAAPI와 비슷한 `Animation` 컨트롤러. 완전한 WAAPI 폴리필과의 차이는 다음과 같습니다.

-   CSS 문자열은 파싱하지 않습니다. WAAPI는 `{ transform: 'translate(100px)' }`를 허용하지만, 파싱 비용이 큽니다. `{ x: 100 }`처럼 Motion 스타일의 독립된 transform 속성을 선호합니다.
-   `ease`, `ease-in`, `ease-out`, `linear`를 내장하고, Motion 스타일의 `spring(mass, stiffness, damping)`도 지원합니다.
-   **Composite** 모드. WAAPI의 `composite: 'add' | 'replace'`처럼, 기본값 위에 애니메이션을 쌓습니다(예: 엔티티 위치에 애니메이션되는 오프셋을 더함).
-   **Timeline** 지원. Motion의 `timeline()`이나 WAAPI의 `GroupEffect`처럼, 엔티티 사이의 stagger를 포함합니다.

### 컨트롤러 {#controller}

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

### 보간 {#interpolation}

`x` / `y` / `opacity` 같은 스칼라는 간단히 보간됩니다. `fill` / `stroke`는 `d3-color` 같은 것으로 색을 파싱한 뒤, rgba 채널마다 보간합니다.

선형 그라디언트는 스톱 개수가 같으면 각 스톱의 위치와 색을 보간합니다. 스톱 개수가 다르면 두 그라디언트의 스톱 위치를 합치고, 급격한 색 전환을 나타내는 중복 위치는 유지합니다. 그래서 두 키프레임이 같은 그라디언트를 담을 때, 균일하지 않은 간격이 보존됩니다.

ECS에서 `fill` / `fillOpacity`와 `stroke` / `strokeOpacity`는 처음 활성화된 페인트 레이어를 함께 갱신합니다. 다른 레이어와 그 활성화 상태는 유지됩니다. 활성화된 레이어가 없으면, 페인트를 애니메이션할 때 레이어를 하나 추가합니다. 불투명도만 애니메이션할 때는 새 레이어를 만들지 않습니다.

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

### 이징 {#easing-function}

표준 곡선 외에 `spring`도 지원할 수 있습니다.

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

### 변환 원점 {#transform-origin}

<AnimationTransformOrigin />

## 특수 애니메이션 효과 {#special-effects}

### 패스 애니메이션 {#path-animation}

패스를 따라 그래픽을 움직이는 일은 흔합니다. CSS에서는 Motion Path를 사용합니다.

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

### 스트로크 애니메이션 {#stroke-animation}

패스 길이가 필요합니다.

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

### 대시 오프셋 {#dashline-offset}

draw.io는 애니메이션으로 커넥터 방향을 보여 줍니다.

![출처: https://www.drawio.com/doc/faq/connector-animate](https://www.drawio.com/assets/img/blog/connector-flow-animation.svg)

> 다이어그램을 SVG 파일로 내보내면, SVG 이미지를 지원하는 웹 페이지나 콘텐츠 플랫폼에 게시할 때 커넥터 애니메이션이 포함됩니다.

```ts
api.animate(node, [{ strokeDashoffset: -20 }, { strokeDashoffset: 0 }], {
    duration: 500,
    iterations: Infinity,
});
```

<AnimationDashoffset />

### 모핑 {#morphing}

많은 SVG 라이브러리가 모핑을 보여 줍니다.

-   [Paper.js]
-   [Kute.js]는 Morph와 CubicMorph를 제공합니다
-   GreenSock의 MorphSVGPlugin은 Canvas에서도 렌더할 수 있습니다
-   [vectalign]

일부 라이브러리는 모핑 전과 후의 세그먼트 구조가 같아야 하며, 그렇지 않으면 보간에 실패합니다.

Kute.js의 CubicMorph를 따릅니다. 패스 세그먼트를 3차 베지에로 변환하고, 3차 베지에는 분할이 쉽다는 점을 이용해 두 패스의 세그먼트 수를 같게 맞춘 다음, 세그먼트마다 제어점을 보간합니다.

와인딩과 시작점 정렬은 두 패스가 모두 닫힌 윤곽 하나만 포함할 때만 적용됩니다. 열린 패스는 끝점 순서를 유지하므로, 곡선을 평행이동해도 끝점이 바뀌지 않고 애니메이션 도중에 곡선이 붕괴하지도 않습니다.

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
-   [lottie-parser] — 주로 그 파싱 로직을 따릅니다
-   [velato] — Vello 위에 만든 렌더러입니다

### 사용법 {#lottie-usage}

Lottie JSON을 그래픽과 키프레임으로 변환하는 플러그인을 구현했습니다. 요점은 다음과 같습니다.

-   Shape 레이어의 다음 요소를 지원합니다.
    -   [Rectangle](https://lottiefiles.github.io/lottie-docs/shapes/#rectangle)
    -   [Ellipse](https://lottiefiles.github.io/lottie-docs/shapes/#ellipse)
    -   [PolyStar](https://lottiefiles.github.io/lottie-docs/shapes/#polystar)
    -   [Path](https://lottiefiles.github.io/lottie-docs/shapes/#path)
    -   [Group](https://lottiefiles.github.io/lottie-docs/shapes/#group)
-   Lottie에서 `anchorX` / `anchorY`는 도형 바운딩 박스의 왼쪽 위를 기준으로 스케일과 회전의 중심을 정의합니다. `transformOrigin`으로 대응시킬 때 주의하세요
-   여러 애니메이션 트랙을 키프레임 집합 하나로 합치고, 빠진 속성을 채웁니다

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

아래는 우리 환경에서 실행한 공식 샘플입니다. [Bouncy Ball]

<AnimationLottieBouncyBall />

### 호환성 {#lottie-compatibility}

이 임포터는 Lottie를 ECS 노드와 키프레임으로 변환합니다. 완전한 Lottie 렌더러는 아닙니다. 필드를 파싱했다고 해서 그 시각 효과가 구현된 것은 아닙니다.

| 기능                                                | 현재 동작                                                                                                                                                                                                      |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 사각형, 타원, 패스, 그룹. 기본 채우기/스트로크      | 기본적인 정적 지오메트리, 패스 모핑, 2D 위치/회전/스케일. 프리미티브의 크기/모서리 애니메이션은 여전히 제한됩니다                                                                                              |
| PolyStar                                            | 별/다각형, 양쪽 와인딩, 꼭짓점 수, 위치, 회전, 안쪽/바깥쪽 반지름과 라운드니스. 시간 이징과 홀드가 있는 숫자 키프레임                                                                                          |
| Repeater                                            | 앞에 있는 도형/그룹의 복사본. 개수, 오프셋, 앵커, 이동, 스케일, 회전, 시작/끝 불투명도, 합성 순서. 숫자 키프레임 포함                                                                                          |
| Solid, Null, 부모 관계, Precomp                     | 기본 지원. 레이어 in/out 가시성, 타임 스트레치, 리매핑은 불완전합니다                                                                                                                                          |
| 그라디언트와 여러 페인트                            | 기본 그라디언트. 애니메이션되는 그라디언트 지오메트리, 방사형 하이라이트, 여러 페인트/연산자의 순서는 여전히 제한됩니다                                                                                        |
| Trim Paths                                          | 스트로크 대시로 근사하며, 전체/빈 커버리지, 끝점 순서 정렬, 오프셋을 보정했습니다. 채운 지오메트리, 다중 패스 모드, 기존 대시 패턴, 애니메이션되는 길이 0의 둥근 캡, 방향, 모디파이어 순서는 여전히 제한됩니다 |
| 공간 베지에 모션, Skew                              | 불완전하며, 검사 중에 보고됩니다                                                                                                                                                                               |
| Merge Paths, Round Corners와 그 밖의 모디파이어     | 렌더되지 않습니다                                                                                                                                                                                              |
| Image                                               | 부분 지원. 에셋 디렉터리와 프리로드는 구현되어 있지 않습니다                                                                                                                                                   |
| Text, Masks, Track Mattes, Effects, Blend Modes, 3D | 구현되지 않았거나 안정적으로 렌더되지 않습니다. ECS가 해당 기능을 갖추고 있어도 Lottie 임포트를 지원한다는 뜻은 아닙니다                                                                                       |
| Expressions                                         | 임포트할 때 베이크합니다. 기본값은 제한된 shape 레이어 환경의, 번들로 포함된 lottie-web ExpressionManager이며, AE의 의미 전체를 따르지는 않습니다                                                              |

`inspectLottie(data)`는 JSON을 바꾸거나 표현식을 평가하지 않고 알려진 빈틈을 검사합니다. `animation.getDiagnostics()`와 `onDiagnostic`은 안정적인 `code`, `severity`(`partial` / `unsupported`), JSON Pointer `path`, 메시지를 제공합니다. 진단이 있어도 임포트는 계속됩니다. 목록이 비어 있어도 AE 호환이 보증되지는 않습니다. 예제에서 **Compatibility notes**를 펼치면 그 빈틈을 볼 수 있습니다.

재생은 컴포지션 시계 하나를 사용합니다. `goTo(value, true)`는 컴포지션 기준 프레임으로 이동합니다. 기본 단위는 초이며, 재생/일시정지 상태는 유지됩니다. `stop()`은 0프레임에서 일시정지합니다. `setSpeed()`은 양의 배율을 받습니다. `setDirection(-1)`은 속도를 유지한 채 현재 위치에서 거꾸로 재생합니다. `playSegments([start, end])`은 두 끝점을 모두 따릅니다. 끝점이 내림차순이면 거꾸로 재생합니다. 숫자 `loop`은 추가 반복 횟수입니다. `getAnimations()`이 반환하는 ECS 컨트롤러는 플레이어가 샘플링합니다. 시간은 플레이어 API로 제어하세요.

같은 인스턴스에서 `render(api)`를 반복 호출해도 멱등입니다. 다른 캔버스에는 별도 인스턴스가 필요합니다. `destroy()`도 멱등이며, 재생을 취소하고 안전한 편집 안에서 가져온 노드 트리를 제거합니다. 컴포넌트는 언마운트할 때 대기 중인 fetch와 큐에 쌓인 편집도 취소해야 합니다. 브라우저 회귀 테스트는 고정된 프레임을, 버전이 고정된 lottie-web과 비교합니다. 대상은 위치, 단일 패스의 스트로크 Trim Paths, 정수/소수 프레임에서의 PolyStar 지오메트리와 Repeater 그룹입니다. 이 테스트가 포맷 전체의 동등성을 증명하지는 않습니다.

### 별과 다각형 {#lottie-polystar}

PolyStar (`ty: "sr"`)는 닫힌 베지에 패스를 만듭니다. `sy: 1`은 별이고 `sy: 2`는 다각형입니다. 꼭짓점 수(`pt`), 위치(`p`), 회전(`r`), 반지름(`or` / `ir`), 라운드니스(`os` / `is`)는 서로 독립적으로 애니메이션할 수 있습니다. 안쪽 속성은 별에만 적용됩니다. `d: 3`은 와인딩을 뒤집습니다. 소수인 꼭짓점 수는 내림하며, 이는 lottie-web 5.13과 같습니다. 꼭짓점 수 사이를 연속으로 모핑하는 것은 아닙니다.

이 예제는 두 도형을 모두 애니메이션합니다. 일시정지하거나, 역재생하거나, **Seek frame**을 드래그해 중간 지오메트리를 확인하세요. 파라미터는 패스를 만들기 전에 보간되므로, 회전해도 반지름이 유지되고 꼭짓점 수의 변화는 정확한 순간에 적용됩니다.

<AnimationLottiePolyStar />

애니메이션되는 PolyStar 지오메트리는 컴포지션 시계 위의 플러그인 컨트롤러가 샘플링합니다. 다시 불러오려면 원본 Lottie JSON을 남겨 두세요. 일반 ECS 키프레임 직렬화와 애니메이션 에디터는 아직 이 절차적 파라미터 트랙을 보존하거나 편집하지 않습니다. 위치의 공간 탄젠트, 모디파이어 조합(변하는 지오메트리 위의 Trim Paths 포함), 표현식, 그리고 표에 있는 다른 제한은 여전히 적용됩니다. 곡선 스트로크는 테셀레이션된 일부 조인에서 ECS 렌더러에 이미 있는 투명도 이음도 물려받습니다. 그 참조 테스트는 실루엣과 색을 확인하며, 알파가 일치하는지는 확인하지 않습니다.

### Lottie의 베지에 곡선 {#beziers-in-lottie}

[Beziers in Lottie]

-   `v`는 정점의 배열입니다.
-   `i`는 `v`에 상대적인 “in” 탄젠트 점의 배열입니다.
-   `o`는 `v`에 상대적인 “out” 탄젠트 점의 배열입니다.
-   `c`는 폴리베지에가 닫혀 있는지를 정하는 불리언입니다. 닫혀 있으면 `v`의 마지막 점과 첫 점 사이에 베지에 세그먼트가 하나 더 있습니다.

### Repeater {#repeater}

Repeater (`ty: "rp"`)는 현재 셰이프 그룹에서 자신보다 앞에 있는 연산자를 복제합니다. 각 복사본을 따로 칠하려면 채우기/스트로크를 **반복되는 그룹 안**에 두세요. 중첩된 셰이프 그룹과 애니메이션되는 PolyStar 지오메트리도 반복할 수 있습니다. 중첩되거나 쌓인 Repeater는 현재 재귀적으로 복제하며 `shape.repeater.nested`를 냅니다. 복합 순서와 남겨 두는 원본 복사본은 lottie-web과 다를 수 있습니다.

복사 수(`c`)는 올림합니다. 0이면 모든 복사본을 숨깁니다. 오프셋(`o`)은 분수와 음수를 받습니다. 변환(`tr`)에는 앵커(`a`), 이동(`p`), 비균등 스케일(`s`), 회전(`r`), 시작/끝 불투명도(`so` / `eo`)가 들어 있습니다. 합성 모드(`m`)는 복사본이 쌓이는 순서를 바꿉니다. 숫자 트랙은 시간 이징과 홀드를 지원합니다. 변환은 lottie-web 5.13을 따르며, 음의 정수 오프셋에서 항등 변환을 가로지르는 동작도 포함합니다.

<AnimationLottieRepeater />

임포터는 이징 오버슈트까지 포함해, 개수 트랙의 상한으로 복사본 풀을 확보합니다. 재생과 시크는 이 풀을 재사용합니다. 큰 개수와 중첩된 repeater는 가져온 노드 수를 곱으로 늘립니다. PolyStar와 같이 원본 Lottie JSON을 남겨 두세요. 일반 ECS 키프레임 직렬화와 애니메이션 에디터는 이 절차적 트랙을 보존하지 않습니다.

Repeater **뒤**의 페인트 연산자는 부분적으로만 지원되며 `shape.repeater.paint-scope`를 냅니다. 복사본마다 페인트를 물려받아도, lottie-web의 공유 복합 채우기가 만드는 커버리지와 불투명도는 재현되지 않습니다. 모디파이어 순서, skew, 공간 모션, 레이어 타이밍은 여전히 호환성 표를 따릅니다. 역변환이 없는 특이 스케일(예: 스케일 0과 음의 오프셋)은 잘못된 변환을 제출하는 대신 영향받는 복사본을 숨깁니다.

### 표현식 {#expression}

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

### 텍스트 레이어 {#text-layer}

텍스트 레이어와 텍스트 애니메이터는 아직 가져오지 않습니다.

### 클리핑 마스크 {#clipping-mask}

마스크 모드, 반전, 애니메이션, Track Matte는 안정적으로 렌더되지 않습니다.

[clipping-masks]

### 레이어 효과 {#layer-effects}

Lottie 이펙트는 아직 ECS에 매핑되지 않았습니다.

[Layer Effects]

## Rive {#rive}

[Rive vs Lottie]

![출처: https://rive.app/blog/rive-as-a-lottie-alternative](https://framerusercontent.com/images/gKzhMgEDMMUPLVkhMtTDfQdQrQ.png?width=1920&height=800)

## Manim {#manim}

<https://github.com/3b1b/manim>

-   [Discussion in HN]

## 애니메이션 에디터 {#animation-editor}

[lottielab]과 [Jitter] 같은 제품에서 착안해, Web Components 계층에 가벼운 애니메이션 에디터를 만들었습니다. 오른쪽 **애니메이션 패널**은 선택한 요소의 키프레임을 편집하고, 아래쪽 **타임라인 패널**은 씬 전체의 타임라인을 보여 주며 그 캔버스의 플레이헤드를 움직입니다. 둘은 같은 직렬화 가능한 키프레임 데이터와 `AppState`의 씬 시계를 공유합니다.

![출처: https://jitter.video/](/jitter.png)

### 레이아웃 {#animation-editor-layout}

태스크바에는 서로 독립된 토글이 두 개 있습니다.

-   `SHOW_ANIMATION_PANEL` → `ic-spectrum-animation-panel` (오른쪽, 속성 패널 옆)
-   `SHOW_TIMELINE_PANEL` → `ic-spectrum-timeline-panel` (아래쪽 도크, 캔버스 전체 너비)

일반적인 작업 흐름:

1. 요소를 하나만 선택하고, 애니메이션 패널에서 애니메이션을 추가하거나 속성 트랙을 편집합니다.
2. 타임라인을 열어, 씬에서 애니메이션되는 모든 레이어와 그 시간 범위를 봅니다.
3. 플레이헤드를 스크럽하거나 재생을 눌러, 한 시점의 씬 전체를 미리 봅니다.
4. 타임라인에서 트랙을 선택하면 그 요소도 선택됩니다. 오른쪽 애니메이션 패널이 그 요소의 키프레임을 보여 줍니다.

### 씬 시계와 편집 모드 {#animation-scene-clock}

타임라인은 각 `AnimationController`와 분리된 **`AppState` 안의 캔버스 플레이헤드**를 움직입니다. ECS 월드를 공유하는 캔버스는 플레이헤드, 재생 상태, 씬 길이를 각자 유지합니다.

| 필드                   | 의미                                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `animationEditing`     | `true`면 **결정적 스크럽 모드**에 들어갑니다. 이 캔버스의 모든 컨트롤러는 각자 자유롭게 진행하지 않고, 같은 `animationCurrentTime`에서 샘플링됩니다 |
| `animationCurrentTime` | 이 캔버스의 플레이헤드 위치(밀리초)                                                                                                                 |
| `animationPlaying`     | 플레이헤드가 자동으로 진행되는지                                                                                                                    |
| `animationLoop`        | 재생이 씬 끝에서 0으로 돌아가는지                                                                                                                   |

`animationEditing === true`일 때 `AnimationSystem`은 그 캔버스에 속한 엔티티만 샘플링합니다. 일시정지 중에는 컨트롤러가 `animationCurrentTime`에 고정됩니다. 재생 중에는 플레이헤드가 `performance.now()`의 델타로 진행합니다. 재생을 다시 시작할 때 일시정지 동안의 벽시계 시간은 빠지며, 씬 길이는 그 캔버스의 트랙으로 정해집니다.

편집 모드를 빠져나오면, 에디터가 일시정지한 컨트롤러는 현재 위치에서 자동 재생을 다시 시작합니다. 호출자가 이미 일시정지한 컨트롤러는 일시정지인 채로 남고, 취소된 컨트롤러는 다시 시작되지 않습니다.

타임라인을 열면 스크럽과 미리보기가 어긋나지 않도록 `setAnimationEditing(true)`가 자동으로 호출됩니다.

### 타임라인 패널 설계 {#animation-timeline}

<AnimationTimeline />

#### 트랙 데이터 {#track-data}

타임라인은 노드 JSON을 직접 읽지 않고, `api.getAnimatedTracks()`로 모읍니다.

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

씬 길이 = 모든 트랙의 `totalDuration` 최댓값. 막대의 `left` / `width`는 `delay * PX_PER_MS`와 `duration * PX_PER_MS`로 계산합니다.

#### 상호작용 {#interactions}

| 동작               | 결과                                                                        |
| ------------------ | --------------------------------------------------------------------------- |
| 트랙 레이블 클릭   | `layersSelected = [track.id]`, 트랙을 강조하고 애니메이션 패널을 구동합니다 |
| 레인 / 룰러 드래그 | 플레이헤드를 스크럽합니다. 캔버스가 그 프레임을 실시간으로 미리 봅니다      |
| 재생 / 일시정지    | `toggleAnimationPlaying()`이 편집 모드에서 씬 전체 시계를 진행합니다        |
| 루프               | `setAnimationLoop()`이 씬이 끝에서 처음으로 돌아가는지를 제어합니다         |

### 애니메이션 패널(타임라인과 함께 동작) {#animation-panel}

컴포넌트: `packages/webcomponents/src/spectrum/animation-panel.ts`.

-   **하나만** 선택했을 때 편집할 수 있습니다. 다중 선택이거나 선택이 없으면 플레이스홀더를 보여 줍니다.
-   전역 옵션: `duration`, `delay`, 기본 `easing`, `iterations`(루프 스위치).
-   키프레임은 **속성 트랙**으로 묶입니다. 각 행에는 `offset`(0–1), 값, `easing`, 삭제 버튼이 있습니다.
-   **Add keyframe at playhead**: `animationCurrentTime`을 읽어 정규화된 오프셋으로 바꾸고, `controller.getCurrentValues()`로 현재 속성 값을 샘플링합니다. 키프레임을 넣기 전에 타임라인을 열고 목표 시각까지 스크럽하세요.
-   `fill` / `stroke`는 팝오버와 `ic-spectrum-color-picker`를 씁니다. 그 밖의 숫자 속성은 `sp-number-field`를 씁니다.
-   패널의 너비와 높이를 바꿀 수 있습니다. 크기는 `localStorage`에 남습니다(속성 패널과 같은 핸들 조작).

모든 편집은 `setNodeAnimation` / `updateNodeAnimationKeyframe`를 거치며, 실행 취소 히스토리와 문서 직렬화에 들어갑니다.

### Lottie 스타일 에디터와의 차이 {#animation-editor-vs-lottie}

현재 구현은 [lottielab] 같은 완전한 DCC 도구에 비해 의도적으로 단순합니다.

-   타임라인은 Lottie의 레이어 + 속성 다중 트랙 배치가 아니라 **노드당 트랙 하나**를 씁니다. 속성 이름은 레이블 접미사로 나타납니다(`Rect · opacity, x`).
-   키프레임과 막대 타이밍은 아직 타임라인에서 드래그할 수 없습니다. 타이밍은 애니메이션 패널의 `offset`으로 편집합니다.
-   표현식은 제한된 임포트 시점 베이킹을 사용합니다. 텍스트 레이어와 클리핑 마스크는 이 에디터가 안정적으로 지원하거나 작성하지 않습니다.

가능한 확장: 속성 하위 트랙, 키프레임 다이아몬드 마커, 막대 가장자리를 드래그해 delay/duration을 바꾸는 기능 등.

### 외부 참고 {#external-references}

-   [lottielab]
-   [omnilottie]
-   [thorvg.viewer]
-   [Jitter]

## 더 읽어보기 {#further-reading}

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
