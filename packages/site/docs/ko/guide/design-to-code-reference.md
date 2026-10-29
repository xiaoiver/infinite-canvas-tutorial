---
title: Design to Code 내보내기 상세
outline: deep
---

# Design to Code 내보내기 상세

[38강](/ko/guide/lesson-038#design-to-code)의 API와 데모도 참고하세요.

## 개념 매핑 {#concept-mapping}

| `.ic` 개념                                          | 코드 출력                                            |
| --------------------------------------------------- | ---------------------------------------------------- |
| `rect`/`g` + `display: flex`                        | `<div>` + flex 유틸리티 (`flex items-center …`)      |
| Flex 방향, 정렬, 크기, 간격, 패딩                   | Tailwind flex 유틸리티 / CSS                         |
| flex가 아닌 컨테이너 안의 자식 `x` / `y`            | 그 컨테이너를 기준으로 한 절대 위치                  |
| `cornerRadius` / `fills` / `strokes` / `dropShadow` | `rounded-* / bg-* / border / shadow-*`               |
| 이미지 채우기가 있는 `rect`                         | `<img src>`와 `object-fit` / `object-position`       |
| CSS 그라디언트 채우기가 하나인 `rect`               | CSS `background-image`                               |
| `ellipse`                                           | CSS `border-radius: 50%`                             |
| 단색 채우기와 스트로크가 있는 리프 `path`           | 벡터 지오메트리가 있는 인라인 SVG `<path>`           |
| 단색 스트로크가 있는 리프 `line` / `polyline`       | 열린 벡터 지오메트리가 있는 인라인 SVG `<path>`      |
| `rect` / `ellipse` + `clipMode: clip`               | 클리핑 요소의 CSS `overflow: hidden`                 |
| `rotation` / `scaleX` / `scaleY`                    | 로컬 왼쪽 위 모서리를 기준으로 한 CSS `transform`    |
| 노드 수준의 `blendMode`                             | CSS `mix-blend-mode`                                 |
| `visibility: hidden` / `visible`                    | 레이아웃 공간을 제거하지 않는 CSS visibility         |
| `text` + `content`                                  | 텍스트 노드. 알려진 `$token` 내용 → 텍스트 값        |
| 텍스트 장식의 선, 스타일, 색, 두께                  | CSS `text-decoration`                                |
| `fontVariant` / `fontKerning`                       | CSS `font-variant` / `font-kerning`                  |
| `wordWrap` / `wordWrapWidth`                        | `white-space`, `overflow-wrap`, 그리고 `max-width`   |
| `maxLines` / `textOverflow`                         | CSS 라인 클램프 또는 잘린 줄 수                      |
| `iconfont` (lucide)                                 | `lucide-react`의 `<Search />`                        |
| `iconfont` (다른 패밀리)                            | `@iconify/react`의 `<Icon icon="family:name" />`     |
| `$color.bg` 변수                                    | `bg-[var(--color-bg)]` (css-var) / 리터럴 (resolved) |
| `reusable` 루트                                     | React 컴포넌트 정의                                  |
| `ref` + `descendants` 오버라이드                    | props가 있는 컴포넌트 인스턴스                       |
| `name`                                              | 컴포넌트 / prop / class 이름                         |

## 컴포넌트 및 출력 규칙

`componentStructure: 'preserve'`(기본값이며 Pencil의 강점)에서는 각 `reusable` 루트가 컴포넌트가 되고, 모든 `ref`가 인스턴스가 됩니다. 인스턴스 전반에서 보이는 덮어쓸 수 있는 속성(`content`, `fills`, `fontVariant`와 `fontKerning`을 포함한 타이포그래피, 텍스트 장식, `opacity`, `visibility`, `cornerRadius`, 명시적 `width`/`height`, `minWidth`/`maxWidth`/`minHeight`/`maxHeight`, `padding`, `margin`, flex 간격, `flexDirection`, `alignItems`, `justifyContent`, `flexWrap`, `alignSelf`, `flexGrow`, `flexShrink`, `flexBasis`, `strokeWidth`, `strokes`, 그리고 드롭 섀도 필드)은 템플릿 값을 기본값으로 하여 props로 끌어올립니다.

숫자 `lineHeight` 값은 `.ic`에서 픽셀 높이이므로, React 출력은 이를 단위 없는 배수로 다루지 않고 `px`를 붙입니다. 불리언 `fontKerning`은 CSS `normal` 또는 `none`이 됩니다.

간격 배열은 CSS 단축 문자열이 되고, 텍스트 장식 필드는 하나의 prop으로 합쳐지며, 그림자 필드는 하나의 `boxShadow` prop으로 합쳐집니다. 두께가 0인 장식은 캔버스와 같이 `none`으로 렌더됩니다.

### 텍스트

텍스트 내보내기는 단위 없는 `1.2` 줄 높이를, 명시적 `lineHeight`가 없을 때 사용하여, 브라우저의 flex 간격이 캔버스 텍스트 메트릭에 가깝게 유지됩니다. 명시한 숫자 `lineHeight`는 여전히 픽셀로 내보냅니다.

명시적 줄바꿈은 `white-space: pre`로 유지됩니다. `wordWrap`이 켜져 있고 `wordWrapWidth`가 양수이면, 출력은 `pre-wrap`, `overflow-wrap: anywhere`를 쓰고 그 너비를 최댓값으로 합니다.

양수 `maxLines`는 `ellipsis`(기본값)에는 CSS 라인 클램프를, `clip`에는 줄 높이로 자르는 제한을 더합니다. 이미 줄바꿈된 reusable 텍스트의 줄바꿈 너비만 고치면 컴포넌트 prop이 됩니다.

줄바꿈을 켜거나 끄거나 잘라내기 설정을 바꾸면 인스턴스가 펼쳐져, 내보낸 레이아웃이 그 편집을 따릅니다. 캔버스는 현재 텍스트 측정에 `whiteSpace` 설정을 적용하지 않습니다.

사용자 지정 `textOverflow` 마커 문자열은 표준 CSS에 대응 값이 없습니다.

### 이미지와 채우기

reusable 이미지에서 이미지 URL만 바꾸면, 인스턴스의 `fills` 오버라이드가 컴포넌트의 `<img src>` prop에 묶입니다. 채우기 유형, 맞춤, 위치, 채우기 불투명도를 바꾸면 인스턴스가 펼쳐져, 생성된 요소와 스타일이 그 편집을 반영합니다. 리프 이미지는 단일 채우기 불투명도와 노드 불투명도를 `<img>` 위에서 합칩니다. 타원의 단일 이미지 채우기는 둥근 `<img>`로 내보냅니다. 자식이 있는 이미지 채우기 사각형과 타원은 위치가 지정된 래퍼를 쓰고, 장식용 `<img>`를 그 자식들 뒤에 둡니다. 래퍼는 노드 불투명도를 가지고, `<img>`는 채우기 불투명도, 맞춤, 위치를 가집니다.

활성화된 CSS 선형, 방사형 또는 원뿔 그라디언트 채우기가 하나인 사각형은 그 그라디언트를 `background-image`로 내보냅니다. 인스턴스에서 그라디언트 값만 고치면 컴포넌트 prop이 됩니다.

단색, 지원되는 그라디언트, 이미지 또는 패턴 채우기가 여러 개인 사각형과 타원은 페인트 순서대로 쌓인 배경으로 내보냅니다. 패턴이 하나여도 CSS 배경으로 내보냅니다.

캔버스의 `conic-gradient(circle at …)` 문법은 CSS `conic-gradient(at …)`로 바뀝니다. 이미지 레이어는 `fill`, `contain`, `cover`, `none`, `scale-down`과 위치를 지원하며, 자식 콘텐츠는 페인트보다 위에 둡니다.

패턴은 원래 타일 크기와 반복 설정을 유지합니다. 독립된 불투명도, 이미지 `scale-down`, 또는 지원되는 2D 패턴 변환이 필요한 페인트에서는 생성기가 자식 뒤에 클리핑된 장식 레이어를 냅니다.

CSS가 지원하는 레이어 블렌드 모드는 채우기 스택 안에 머뭅니다. 패턴 변환은 명시적 크기가 있는 사각형과 타원에서 `matrix`, `translate`, `scale`, `rotate`, `skewX`, `skewY`를 지원합니다.

캔버스는 URL 기반 패턴 이미지도 디코드하여 이 변환을 적용합니다. reusable 인스턴스에서 스택이나 패턴을 고치면 그 인스턴스가 펼쳐집니다.

그 밖의 그라디언트 형식, 지원하지 않는 패턴 변환 문법, `linearBurn`과 `linearDodge`처럼 CSS에 대응 값이 없는 블렌드 모드는 여전히 따로 처리해야 합니다.

불투명도가 1 미만인 단색 채우기 하나는 CSS `color-mix`로 내보내며, 자식 요소를 어둡게 하지 않고 채우기 알파를 유지합니다. 노드 불투명도는 별도의 CSS `opacity`로 남습니다. reusable 인스턴스에서 반투명 채우기를 고치면 그 인스턴스가 펼쳐져, 생성된 페인트가 불투명도를 유지합니다.

### 변환과 레이아웃

노드 회전(라디안으로 저장)과 `scaleX` / `scaleY`는 CSS `rotate(...) scale(...)` 변환으로, 원점 `0 0`과 함께 내보내며, 캔버스의 로컬 변환 순서와 맞습니다. 인스턴스 변환을 고치면 그 인스턴스가 펼쳐져, 바뀐 지오메트리가 내보내기에 포함됩니다.

`clipMode: clip`인 사각형과 타원은 생성된 HTML과 React 코드에서 자식을 클리핑합니다. 둥근 사각형은 모서리 반경을 유지하고, 타원은 `border-radius: 50%`를 사용합니다. reusable 인스턴스의 클립 모드를 바꾸면 그 인스턴스가 펼쳐져 클리핑 상태가 유지됩니다. `erase`와 `soft` 마스크는 CSS overflow에 직접 대응하는 값이 없어 클리핑으로 내보내지 않습니다.

flex가 아닌 컨테이너에서 자식은 캔버스의 로컬 `x` / `y`를 CSS `left` / `top` 위치로 사용합니다. flex 자식은 일반적인 flex 흐름에 남습니다. Yoga는 이들의 `flexShrink` 기본값을 `0`으로 두므로, 노드가 다른 값을 지정하지 않으면 내보내기는 `flex-shrink: 0`을 설정합니다. flex가 아닌 컨테이너 안의 보존된 컴포넌트 인스턴스에는 위치가 지정된 래퍼가 붙습니다. 인스턴스 안의 자식을 옮기면 그 인스턴스가 펼쳐져 편집이 남습니다. 최상위 노드가 여러 개이고 모두 명시적 크기를 가지면, 내보내기는 상대 위치 프레임도 더하고, 회전하거나 뒤집은 경계를 포함해 간격을 유지합니다. 측정할 수 있는 크기가 없는 루트는 일반적인 문서 흐름을 유지합니다.

노드 수준 `visibility`는 CSS `visibility`가 되므로, 숨겨진 노드는 레이아웃 공간을 유지합니다. 기본 `inherited` 상태는 CSS 상속을 사용합니다. reusable 인스턴스의 가시성을 바꾸면, 자손 편집을 포함해 컴포넌트 prop이 됩니다.

### 벡터 도형

유효한 `d` 데이터가 있는 패스는 직사각형 플레이스홀더 대신 인라인 SVG로 내보냅니다. Path에 자식이 있으면 그 SVG는 위치가 지정된 래퍼 안에서 자식 뒤에 놓이며, 벡터 윤곽과 각 자식의 로컬 좌표를 유지합니다.

단색, 선형 또는 방사형 그라디언트, 이미지로 만든 채우기 레이어는 캔버스 순서대로 별도의 SVG 패스로 내보내지며, 각 레이어의 불투명도를 유지합니다. CSS가 지원하는 블렌드 모드는 격리된 SVG 그룹 안에서 적용되므로, 아래쪽 채우기 레이어와만 섞입니다.

그 페인트 유형의 활성 스트로크는 페인트, 불투명도, 선·삼각형·마름모 끝점 마커, 채우기 규칙, 너비, 캡, 조인, 마이터 한계, 대시 설정을 유지합니다. 스트로크가 여러 개인 패스, 선, 폴리라인은 공유 지오메트리와 CSS가 지원하는 레이어 블렌딩으로, 각 스트로크를 캔버스 순서대로 내보냅니다.

닫힌 패스는 모든 레이어를 클리핑하거나 마스킹하여 안쪽 또는 바깥쪽 스트로크 정렬도 유지합니다. 열린 패스는 가운데 정렬로 남습니다.

그라디언트와 이미지 페인트는 패스의 viewBox를 따릅니다. 패스 이미지 채우기는 `fill`, `contain`, `cover`, `none`, `scale-down`을 지원하며, 중간 백분율 위치도 포함합니다.

흔한 `fill` / `contain` / `cover` 정렬은 SVG 패턴을 사용합니다. 그 밖의 맞춤과 위치는 클리핑된 SVG `foreignObject`와 CSS `object-fit` / `object-position`을 사용합니다.

이미지 스트로크는 위치가 0%, 50%, 100%인 `fill`, `contain`, `cover`에 SVG 패턴을 사용합니다. 다른 맞춤이나 위치를 쓰는 단일 이미지 스트로크는 위치가 지정된 HTML 이미지와 SVG 지오메트리 마스크를 사용하며, Chromium과 WebKit에서 캡, 조인, 끝점 마커, 안쪽 또는 바깥쪽 정렬을 유지합니다.

이런 맞춤이나 위치를 쓰는 겹친 이미지 스트로크도 SVG 스트로크 레이어와 함께 캔버스 페인트 순서, 지원되는 CSS 블렌드 모드, 불투명도, 끝점 마커를 유지합니다. 내보낸 코드에서는 지속되는 이미지 URL이나 data URL을 사용하세요.

드롭 섀도는 SVG 그래픽을 따르며, Path의 자식에는 그림자를 주지 않습니다. reusable 인스턴스에서 패스 페인트, 지오메트리, 마커, 스트로크 정렬 또는 그림자 오버라이드는 그 인스턴스를 펼쳐 SVG가 편집을 반영하게 합니다.

`linearBurn`과 `linearDodge`처럼 CSS에 대응 값이 없는 블렌드 모드, 원뿔 그라디언트와 메시 그라디언트, 그 밖의 패스 필터는 별도의 SVG 처리가 필요합니다.

리프 선과 폴리라인은 같은 SVG 파이프라인을 사용합니다. 로컬 끝점 또는 점 목록은 채우기 없는 열린 패스가 됩니다. SVG viewBox는 지오메트리의 로컬 원점을 따르고, 너비 0 또는 높이 0인 축을 가운데에 두므로, 오프셋된 패스와 얇은 가로·세로 스트로크도 생성된 코드에서 보입니다. 스트로크에는 활성화된 단색, 선형 그라디언트, 방사형 그라디언트 또는 이미지 페인트를 하나 쓸 수 있습니다. 선, 삼각형, 마름모 화살촉은 스트로크 페인트를 쓰는 로컬 SVG 마커를 사용합니다. reusable 선 또는 폴리라인 인스턴스의 지오메트리, 페인트, 마커 편집도 그 인스턴스를 펼칩니다. 그 밖의 선 효과는 여전히 따로 처리해야 합니다.

노드 수준 `blendMode`는 CSS `mix-blend-mode`가 되며, 인스턴스가 이를 바꾸면 컴포넌트 prop도 포함합니다. `light`는 CSS `lighten`에 대응합니다. CSS에 대응 값이 없는 모드는 SVG 내보내기를 따라 `normal`로 렌더됩니다. 채우기 레이어 자신의 `blendMode`는 그 노드의 다른 채우기와 섞이며, 노드 수준의 `mix-blend-mode`로 다루지 않습니다.

## 실제 예시 {#practical-interface-examples}

다음 예시는 분석 대시보드, SaaS 요금 페이지, 모바일 결제 화면을 **IC 에디터 캔버스**에 불러옵니다. 세 씬 모두 중첩 flex 레이아웃과 시맨틱 색 변수를 사용합니다. 결제 화면은 390 × 844의 좁은 아트보드를 사용합니다. 캔버스에서 노드를 선택하고 편집한 다음, `API.exportCode`로 캔버스의 현재 문서에서 생성한 코드를 새로고침하거나 복사하거나 다운로드하세요. HTML/CSS를 선택한 상태에서는 **HTML 미리보기**로, 생성된 페이지를 아트보드 크기의 샌드박스 프레임에서 봅니다. 디자인을 전환하면 편집할 수 있는 다른 씬이 로드됩니다.

예시는 노드 ID를 키로 하는 `semanticElements` 맵을 `API.exportCode`에 넘깁니다. 이 맵은 고른 캔버스 사각형과 텍스트를, 두 내보내기 모두에서 HTML 랜드마크, 제목, `<button type="button">` 컨트롤로 바꿉니다. 이 맵은 이 데모의 내보내기 설정에 속합니다. 버튼 동작과 탐색은 애플리케이션에서 연결하세요.

요금 페이지는 `reusable` 요금제 카드 템플릿 하나와 `ref` 인스턴스 세 개를 사용합니다. 에디터는 인스턴스를 펼쳐 렌더하고 편집합니다. 이 데모는 텍스트, 색, 타이포그래피와 텍스트 장식, 불투명도, 명시적 크기와 크기 제약, 간격, flex 정렬과 항목 크기, 단색 테두리, 드롭 섀도 편집을 React와 `.ic` 다운로드용 인스턴스 오버라이드로 다시 맞춥니다. Growth 카드는 강조 테두리를 보여 줍니다. 숫자 `flexBasis`와 크기 제약 값은 HTML/CSS와 React 스타일에서 픽셀 값이 됩니다. 카드의 구조나 지원하지 않는 속성이 바뀌면, 내보내기는 펼친 노드를 사용하여 결과가 여전히 캔버스와 맞습니다.

세 React 내보내기는 React 19와 Tailwind CSS 4로 브라우저 테스트에서도 렌더됩니다. 테스트는 주요 텍스트 위치를 HTML 미리보기와 대조하여, 생성기가 바뀌어도 이 예시들이 계속 실행될 수 있게 합니다.

`.ic` 파일을 다운로드하면 [온라인 앱](https://app.infinitecanvas.cc/)에서 **Import from… > .ic**으로 디자인을 이어서 편집할 수 있습니다. HTML 파일을 다운로드하여 브라우저에서 바로 여세요.

React라면 **React 프로젝트 다운로드**를 선택하여, 현재 캔버스에서 Vite, React 19, Tailwind CSS 4 스타터 ZIP을 받으세요. 압축을 푼 다음 `pnpm install`과 `pnpm dev`를 실행하세요.

내보낸 컴포넌트는 `src/App.tsx`에 있습니다. 스타터는 디자인이 Inter를 사용할 때 그 폰트를 로컬로 번들합니다.

현재 캔버스의 임시 `blob:` 이미지는 `public/assets`로 복사되고 로컬 경로로 참조됩니다. data URL은 인라인으로 남고, 원격 URL은 원격 그대로입니다.

`src/responsive.css`는 이 세 예시에 좁은 화면 레이아웃을 더하고, `src/App.tsx`의 아트보드 크기 컴포넌트는 유지합니다. 기존 프로젝트용으로 `.tsx` 파일만 다운로드할 수도 있습니다.

생성기는 현재 표현용 마크업을 냅니다. 내보내기 후에 탐색, 체크아웃 동작, 결제, 실시간 데이터를 애플리케이션 로직에 연결하세요.
