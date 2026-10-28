---
outline: deep
description: 'Jest로 단위 테스트, 시각적 회귀 테스트, headless-gl 기반 서버 사이드 렌더링, Playwright 기반 E2E 테스트, 브라우저 호환성 테스트를 포함한 종합 테스트 환경을 구성합니다.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: '11강 - 테스트와 서버 사이드 렌더링',
          },
      ]
---

# 11강 - 테스트와 서버 사이드 렌더링 {#lesson-11-test-and-server-side-rendering}

현재 캔버스 기능은 점점 더 복잡해지고 있으므로, 프로젝트 품질을 높이기 위해 테스트를 도입할 시점입니다. 이번 강의에서는 다음 내용을 다룹니다.

-   Jest 기반 테스트 환경 구성. 로컬 환경과 CI 환경을 포함합니다
-   단위 테스트로 코드 커버리지 높이기
-   시각적 회귀 테스트
    -   headless-gl 기반 서버 사이드 렌더링. 대상은 WebGL1입니다
    -   Playwright 기반 E2E 테스트. 대상은 WebGL2와 WebGPU입니다
-   E2E UI 테스트
-   BrowserStack 기반 브라우저 호환성 테스트
-   WebWorker에서 렌더링

위에서 다룬 프로젝트 관련 코드는 모두 프로젝트의 [\_\_tests\_\_] 폴더에서 찾을 수 있습니다.

## 테스트 환경 {#test-environment}

테스트 프레임워크로는 Jest를 선택하고, `package.json`에 코드 커버리지를 집계하는 테스트 명령을 추가합니다.

```json
"scripts": {
    "cov": "jest --coverage"
}
```

GitHub 워크플로에서 테스트 명령 `pnpm cov`를 실행합니다. 서버 사이드 렌더링을 도입한 뒤에는 이 명령 앞에 `xvfb-run`을 붙입니다.

```yaml
- name: Cov
run: |
    xvfb-run -s "-ac -screen 0 1280x1024x16" pnpm cov
env:
    CI: true
- name: Coveralls
uses: coverallsapp/github-action@master
with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

`d3-color`를 쓰면 흔히 마주치는 문제에 부딪힙니다. D3는 기본적으로 ESM 출력만 제공하므로 Node.js에서 직접 실행할 수 없습니다. 선택지는 두 가지입니다.

1. Jest는 [transformIgnorePatterns] 설정을 제공하므로, `d3-color`는 물론 D3 관련 의존성까지 추가한 뒤 CJS로 컴파일할 수 있습니다.
2. D3 대체 라이브러리 [victory-vendor]를 사용합니다. 기능은 동일하고 CJS 출력을 추가로 제공합니다. [d3-color issue in recharts]를 참고하세요.

첫 번째 방식을 선택합니다.

```js
const esm = ['d3-*'].map((d) => `_${d}|${d}`).join('|');
module.exports = {
    transformIgnorePatterns: [`<rootDir>/node_modules/(?!(?:.pnpm/)?(${esm}))`],
};
```

테스트 환경이 준비되었으니, 이제 첫 테스트 케이스를 작성할 수 있습니다.

## 단위 테스트 {#unit-test}

구현하기 가장 쉬운 단위 테스트부터 시작합니다. 단위 테스트는 렌더링과 무관한 기능을 검사하기에 좋습니다. 그래픽 속성 설정, 바운딩 박스 크기 계산, 피킹 판정, 각종 유틸 메서드 등이 해당합니다.

```ts
// __tests__/unit/circle.spec.ts
import { Circle } from '../../packages/core/src';

describe('Circle', () => {
    it('should get/set attributes correctly.', () => {
        const circle = new Circle({
            cx: 50,
            cy: 50,
            r: 50,
            fill: '#F67676',
        });
        expect(circle.cx).toBe(50);
    });
});
```

좋습니다. Circle의 테스트 커버리지를 100%까지 올렸습니다.

```bash
------------------------------|---------|----------|---------|---------|-----------------------
File                          | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
------------------------------|---------|----------|---------|---------|-----------------------
All files                     |   14.21 |    10.44 |    8.18 |   14.29 |
 src/shapes                   |   26.81 |    22.64 |   21.62 |   28.15 |
  Circle.ts                   |     100 |      100 |     100 |     100 |
```

하지만 단위 테스트에는 한계가 있습니다. 결국 코드의 작은 부분만 대상으로 하므로, 시스템 전체가 올바르게 동작하는지는 보장하지 못합니다. 예를 들어 원 하나가 올바르게 그려졌는지는 판단할 수 있어도, 원이 100개라면 어떨까요? 테스트 단언을 작성하는 데 훨씬 더 많은 시간과 노력이 듭니다.

## 시각적 회귀 테스트 {#visual-regression-testing}

테스트 분야에서 "golden image"는 테스트 케이스 집합 안의 표준 이미지, 즉 참조 이미지를 가리키는 용어입니다. 이 용어는 시각적 회귀 테스트(Visual Regression Testing)에서 자주 쓰입니다. 시각적 회귀 테스트는 애플리케이션이나 웹사이트의 스크린샷을 미리 정의한 참조 이미지 집합과 비교하여 시각적 변화를 감지하는 자동화 테스트 방법입니다.

렌더링 엔진에서는 단위 테스트보다 렌더링 결과가 올바른지 검증하기 쉽고, 수동 단언을 작성해야 하는 부담도 크게 줄어듭니다. [pixelmatch]를 사용하면 이미지를 쉽게 비교하고 차이 부분을 강조할 수 있습니다.

![pixelmatch](/pixelmatch.png)

Node.js에서 스크린샷을 얻는 방법은 두 가지로 생각할 수 있습니다.

1. 서버 사이드 렌더링. 렌더링 기술에 따라 그에 맞는 Node.js 구현을 고르면 됩니다.

    - [node-canvas] Cairo 기반 Canvas 구현
    - [jsdom] DOM과 HTML의 순수 JS 구현
    - [headless-gl]은 WebGL 컨텍스트를 만들 수 있지만 WebGL1만 지원합니다.

2. 헤드리스 브라우저. 초기의 puppeteer, electron, 또는 비교적 새로운 Playwright가 예입니다.

널리 쓰이는 렌더링 엔진이 현재 어떤 방식을 쓰는지 살펴보면 흥미롭습니다.

-   [Three.js Puppeteer]
-   Babylon.js는 한때 Jest + Puppeteer를 사용했지만 지금은 Playwright를 사용합니다. [Move visualization testing to playwright]를 참고하세요.
-   luma.gl은 [headless-gl]을 사용합니다. [Register devices]를 참고하세요.
-   plot은 [mocha + JSDOM]을 사용합니다.

두 방식을 각각 살펴보겠습니다.

### 서버 사이드 렌더링 {#server-side-rendering}

headless-gl 구현에 기반한 서버 사이드 렌더링은 WebGL1만 지원하지만, 서버 사이드 렌더링이 적합한 시나리오가 있습니다.

-   상호작용이 거의 없거나 전혀 없는 시나리오
-   실시간성이 크게 요구되지 않아 오프라인으로 생성할 수 있고, 런타임 성능 문제가 없는, 상호작용이 약하거나 아예 없는 장면
-   출력이 여러 환경에 걸쳐 표시할 수 있는 픽셀 이미지 또는 벡터 이미지인 경우

서버 사이드 렌더링을 지원하려면 코드가 Node.js 환경에서 실행되어야 합니다. 그렇다면 코드 안의 DOM API 호출은 어떻게 처리해야 할까요? 첫 번째 생각은 환경에 따라 분기하는 것입니다. 예를 들어 브라우저 환경에서만 이벤트 리스너를 등록하고 `addEventListener()` 메서드를 호출합니다.

```ts{2}
const plugins = [
    isBrowser ? new DOMEventListener() : undefined,
    //...
];
```

또 다른 접근은 [d3-selector]에서 볼 수 있습니다. 여기서는 전역 변수 `document`가 존재한다고 가정하지 않고, 컨텍스트에서 가져옵니다. 그러면 상위 계층이 `jsdom` 같은 DOM API의 순수 JS 구현을 넘길 기회가 생기고, 서버 쪽에서도 동작합니다.

```ts{3}
function creatorInherit(name) {
  return function() {
    var document = this.ownerDocument,
        uri = this.namespaceURI;
    return uri === xhtml && document.documentElement.namespaceURI === xhtml
        ? document.createElement(name)
        : document.createElementNS(uri, name);
  };
}
```

같은 발상은 [react-reconciler]에서도 볼 수 있습니다. DOM, Canvas, 콘솔처럼 서로 다른 환경은 설정에서 합의한 인터페이스만 구현하면 됩니다.

> "host config"는 직접 제공해야 하는 객체이며, "host" 환경(예: DOM, canvas, console, 또는 렌더링 대상이 무엇이든)에서 어떤 일이 일어나게 하는 방법을 설명합니다. 형태는 다음과 같습니다.

```ts
const HostConfig = {
    createInstance(type, props) {
        // e.g. DOM renderer returns a DOM node
    },
    // ...
    appendChild(parent, child) {
        // e.g. DOM renderer would call .appendChild() here
    },
    // ...
};
```

Vite의 [Environment API]도 비슷한 문제를 해결하려 합니다.

> Runtime API에서 시작된 변경은 이제 Vite가 환경(client, SSR, workerd 등)을 다루는 방식을 전면적으로 재검토하도록 이끌고 있습니다.

우리 상황으로 돌아오면, Node.js 환경에는 다음 설정 항목을 제공해야 합니다.

```ts
export interface CanvasConfig {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
     */
    devicePixelRatio?: number;
    /**
     * There is no `style.cursor = 'pointer'` in WebWorker.
     */
    setCursor?: (cursor: Cursor | string) => void;
}
```

#### PNG 생성 {#ssr-png}

[headless-gl]을 사용하면 WebGLRenderingContext를 만들고, 이를 HTMLCanvasElement와 같은 형태의 객체로 감쌀 수 있습니다. 이후에는 이 객체로 캔버스를 평소처럼 만들 수 있습니다.

```ts
export function getCanvas(width = 100, height = 100) {
    let gl = _gl(width, height, {
        antialias: false,
        preserveDrawingBuffer: true,
        stencil: true,
    });

    const mockedCanvas: HTMLCanvasElement = {
        width,
        height,
        getContext: () => {
            gl.canvas = mockedCanvas;
            return gl;
        },
        addEventListener: () => {},
    };

    return mockedCanvas;
}
```

WebGLRenderingContext를 얻은 뒤에는 [readPixels]를 호출해 지정한 영역의 픽셀 값을 읽고, 이를 PNG에 기록하여 기준 이미지를 얻습니다.

```ts
async function writePNG(gl: WebGLRenderingContext, path: string) {
    const width = gl.canvas.width;
    const height = gl.canvas.height;

    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    await createPNGFromRawdata(path, width, height, pixels);
}
```

테스트를 실행할 때마다 [pixelmatch]로 기준 이미지와 이번 테스트가 생성한 이미지를 비교하고, 차이도 파일에 기록해 쉽게 볼 수 있습니다. 여기에는 Jest가 제공하는 사용자 정의 단언 확장을 사용합니다.

```ts
// useSnapshotMatchers.ts
// @see https://jestjs.io/docs/26.x/expect#expectextendmatchers
expect.extend({
    toMatchWebGLSnapshot,
    toMatchSVGSnapshot,
});

// Diff with golden image in test case.
expect($canvas.getContext()).toMatchWebGLSnapshot(dir, 'rect');
```

전체 코드는 [toMatchWebGLSnapshot.ts]에 있습니다.

#### SVG 생성 {#ssr-svg}

이미지 내보내기 기능을 테스트하려면 ImageExporter에 브라우저 환경의 대안으로 [jsdom]과 [xmlserializer]를 제공해야 합니다. 전자는 Node.js 환경에서 SVGElement를 만드는 데 쓰고, 후자는 이를 문자열로 직렬화하는 데 씁니다.

```ts{6,7}
import xmlserializer from 'xmlserializer';
import { JSDOM } from 'jsdom';

const exporter = new ImageExporter({
    canvas,
    document: new JSDOM().window._document,
    xmlserializer,
});
```

SVGElement 문자열을 얻은 뒤에는 파일에 쓸 수 있습니다. 쓰기 전에 prettier로 포맷하면 읽기 쉬워집니다.

```ts{11}
import xmlserializer from 'xmlserializer';
import { format } from 'prettier';

export function toMatchSVGSnapshot(
    dom: SVGElement | null,
    dir: string,
    name: string,
    options: ToMatchSVGSnapshotOptions = {},
) {
    let actual = dom
      ? format(xmlserializer.serializeToString(dom), {
          parser: 'babel',
        })
}
```

전체 코드는 [toMatchSVGSnapshot.ts]에 있습니다.

#### 상호작용 이벤트를 시뮬레이션하는 방법 {#how-to-mock-event}

JSDOM을 사용하면 `MouseEvent` 같은 상호작용 이벤트를 시뮬레이션하고, 생성 직후 해당하는 훅을 직접 호출할 수 있습니다. 이렇게 하면 DOM API로 이벤트를 수신해야 하는 제약을 우회합니다.

```ts
const window = new JSDOM().window;

const pointerdownEvent = new window.MouseEvent('pointerdown', {
    clientX: 100,
    clientY: 100,
});
canvas.pluginContext.hooks.pointerDown.call(pointerdownEvent);
```

이 방식은 드래그 앤 드롭 같은 이벤트 조합도 쉽게 시뮬레이션합니다. 다음 테스트 케이스는 [Drag & Drop Plugin]의 판정 임계값을 테스트하는 예입니다. 연속된 `pointerdown`, `pointermove`, `pointerup` 이벤트를 시뮬레이션하지만, 인접한 이벤트 사이의 간격이 짧고 거리가 가까우므로 `dragstart` 이벤트는 발생하지 않습니다.

```ts
const dragstartHandler = jest.fn();

canvas.root.addEventListener('dragstart', dragstartHandler);
canvas.pluginContext.hooks.pointerDown.call(
    createMouseEvent('pointerdown', { clientX: 100, clientY: 100 }),
);
canvas.pluginContext.hooks.pointerMove.call(
    createMouseEvent('pointermove', { clientX: 101, clientY: 101 }),
);
canvas.pluginContext.hooks.pointerUp.call(
    createMouseEvent('pointerup', { clientX: 101, clientY: 101 }),
);
expect(dragstartHandler).not.toBeCalled();
```

#### CI에서의 SSR {#ssr-ci}

[How can I use headless-gl with a continuous integration service?]

```yaml
- name: Install headless-gl dependencies
    run: |
        sudo apt-get update
        sudo apt-get install -y mesa-utils xvfb libgl1-mesa-dri libglapi-mesa libosmesa6

- name: Cov
    run: |
        xvfb-run -s "-ac -screen 0 1280x1024x16" pnpm cov
```

전체 코드는 [github workflows - test]에 있습니다.

### 헤드리스 브라우저 {#headless-browser}

서버 사이드 렌더링이 아무리 뛰어나도, 헤드리스 브라우저 방식에는 테스트에서 대체할 수 없는 장점이 있습니다. Playwright를 예로 들면 다음과 같습니다.

-   최신 Chrome에서 WebGL 1/2는 물론 WebGPU까지 지원합니다.
-   toHaveScreenshot 같은 공식 단언을 그대로 제공합니다. 픽셀 단위 비교가 내장되어 있고, 실패하면 리포트에 diff가 표시됩니다. 자세한 내용은 [Visual comparisons]를 참고하세요.
-   [sharding]을 지원하여 CI에서 여러 머신으로 병렬 실행할 수 있습니다.

#### 개발 서버 실행 {#run-webserver}

Playwright 브라우저는 개발 서버에 배포된 테스트 케이스에 접근해야 하며, 테스트 서버로는 Vite를 선택했습니다.

```ts{6}
import { devices, defineConfig } from '@playwright/test';

export default defineConfig({
    // Run your local dev server before starting the tests
    webServer: {
        command: 'npm run dev:e2e', // vite dev
        url: 'http://localhost:8080',
        reuseExistingServer: !process.env.CI,
        stdout: 'ignore',
        stderr: 'pipe',
    },
});
```

#### 테스트 케이스 열람 {#browse-testcase}

서버를 시작한 뒤 테스트 케이스에 해당하는 URL에 접근합니다.

```ts
test(name, async ({ page, context }) => {
    const url = `./infinitecanvas/?name=${name}`;
    await page.goto(url);
    await readyPromise;

    await expect(page.locator('canvas')).toHaveScreenshot(`${name}.png`);
});
```

이 결과와 기준 이미지의 비교는 생성된 테스트 리포트에서 시각적으로 확인할 수 있습니다.

![Playwright 이미지 차이](/playwright-image-diff.png)

실제로 로컬에서 생성한 스크린샷은 CI 환경과 조금씩 다른 경우가 많습니다. 예를 들어 아래 이미지의 왼쪽은 로컬 환경에서 생성한 스크린샷이고, 오른쪽은 CI 환경에서 생성한 스크린샷인데, 일부 사각형에 이상한 사선이 있습니다.
이 경우에는 로컬에서 생성한 기준 이미지 대신 CI 환경의 이미지를 사용하면 일관성을 맞출 수 있습니다. GitHub 워크플로 아티팩트를 업로드해 CI 환경의 스크린샷을 얻은 뒤, 로컬로 내려받아 기준 이미지로 쓸 수 있습니다.

![로컬 환경과 CI 환경의 차이](/playwright-local-vs-ci.png)

#### WebGL2와 WebGPU {#webgl2-webgpu}

[headless-gl] 서버 사이드 렌더링과 비교할 때, 엔드투엔드 테스트 방식의 가장 큰 장점은 WebGL2와 WebGPU를 모두 지원한다는 점입니다. 테스트 케이스를 한 세트만 작성하고, URL의 렌더러 설정에 따라 캔버스를 만든 다음, WebGL2와 WebGPU 각각의 기준 이미지를 생성할 수 있습니다.

```ts
['webgl', 'webgpu'].forEach((renderer) => {
    test(`${name} with ${renderer}`, async ({ page, context }) => {
        const url = `./infinitecanvas/?name=${name}`; // [!code --]
        const url = `./infinitecanvas/?name=${name}&renderer=${renderer}`; // [!code ++]
        await page.goto(url);
        await expect(page.locator('canvas')).toHaveScreenshot([
            renderer,
            `${name}.png`,
        ]);
    });
});
```

#### CI 설정 {#e2e-ci}

앞에서 말했듯이 [sharding]은 CI에서 여러 머신의 병렬 실행을 지원하고, 각 머신에서는 여러 스레드를 켤 수 있습니다. 예를 들어 머신 4대를 쓰고, 각 머신에서 워커 10개를 병렬로 실행한 뒤, 마지막에 리포트를 하나로 합칩니다.

```yaml
jobs:
    e2e:
        timeout-minutes: 60
        runs-on: ubuntu-latest
        strategy:
            fail-fast: false
            matrix:
                shard: [1/4, 2/4, 3/4, 4/4]
```

실행 모습은 다음과 같으며, 자세한 내용은 [E2E action]을 참고하세요.

![Playwright 샤딩](/playwright-sharding.png)

#### AWS Lambda 함수 {#aws-lambda-function}

이제 AWS에서 Lambda 함수를 만들어야 합니다. 이 함수는 `headless-gl`이 포함된 사용자 정의 Layer로 서버 사이드 렌더링을 수행합니다.

![AWS Lambda 레이어](/aws-lambda-layer.png)

대상 런타임 환경이 Node.js 20.x이므로, Amazon Linux 2023 이미지로 Layer를 로컬에서 빌드합니다.

```bash
# Lambda runtime compatible base
FROM amazonlinux:2023

# Enable Node.js 20 and essential build tools
RUN yum update -y && \
    yum install -y \
      gcc \
      gcc-c++ \
      make \
      python3 \
      pkgconf-pkg-config \
      mesa-libGL-devel \
      mesa-libEGL-devel \
      mesa-libGLU-devel \
      mesa-libOSMesa-devel \
      libXi-devel \
      libXext-devel \
      libX11-devel \
      libxcb-devel \
      libXau-devel \
      libXdmcp-devel && \
    ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /build

# Create nodejs directory (Lambda Layer structure)
RUN mkdir -p nodejs

# Install Node.js (Amazon Linux 2023 default no Node)
RUN curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - && \
    yum install -y nodejs

# Install headless-gl and dependencies
RUN npm install --prefix ./nodejs gl --build-from-source

# Copy mesa libraries (optional but helps ensure runtime success)
RUN mkdir -p lib64 && \
    cp /usr/lib64/libGL.so.* lib64/ && \
    cp /usr/lib64/libGLU.so.* lib64/ && \
    cp /usr/lib64/libOSMesa.so.* lib64/ && \
    cp /usr/lib64/libX11.so.* lib64/ && \
    cp /usr/lib64/libXau.so.* lib64/ && \
    cp /usr/lib64/libXi.so.* lib64/ && \
    cp /usr/lib64/libxcb.so.* lib64/ && \
    cp /usr/lib64/libXdmcp.so.* lib64/ && \
    cp /usr/lib64/libXext.so.* lib64/ || true

# Package final layer zip (AWS expects nodejs/ at root)
RUN zip -r9 /opt/headless-gl-layer.zip nodejs lib64

CMD ["bash"]
```

그다음 S3에 업로드하여 레이어 생성을 마칩니다.

```bash
aws lambda publish-layer-version \
  --layer-name headless-gl-layer \
  --description "Headless GL for Node.js on AL2 arm64" \
  --compatible-runtimes nodejs20.x \
  --compatible-architectures arm64 \
  --content S3Bucket=<your-bucket>,S3Key=headless-gl-layer.zip
```

이제 AWS 콘솔에서 이 Layer를 선택해 함수에 추가할 수 있습니다.

## E2E 테스트 {#e2e-test}

[Playwright Components (experimental)]은 React, Svelte, Vue 같은 UI 프레임워크의 컴포넌트 수준 테스트를 지원합니다. `@playwright/test`로 테스트 케이스를 작성하는 방식과 비교하면, 매개변수 객체에 `mount` 메서드가 추가되어 있습니다.

```ts{3}
import { test, expect } from '@playwright/experimental-ct-react';

test('should work', async ({ mount }) => {
  const component = await mount(<HelloWorld msg="greetings" />);
  await expect(component).toContainText('Greetings');
});
```

[Lit Testing]에서 권장하는 테스트 프레임워크에는 Playwright가 포함되어 있지 않지만, 커뮤니티의 [Playwright Web component testing]으로 우리의 [Web Components]를 테스트할 수 있습니다.

```ts
import { defineConfig } from '@playwright/test'; // [!code --]
import { defineConfig } from '@sand4rt/experimental-ct-web'; // [!code ++]

export default defineConfig({});
```

이제 우리가 만든 Web Component에 대한 테스트를 작성할 차례입니다.

### Web Component 테스트 {#webcomponent-test}

카메라 확대/축소 툴바 컴포넌트를 예로 들어, `zoom` 속성이 올바르게 표시되는지 테스트할 수 있습니다.

```ts
import { test, expect } from '@sand4rt/experimental-ct-web';
import { ZoomToolbar } from '../../packages/ui/src';

test('should display zoom correctly.', async ({ mount }) => {
    const component = await mount(ZoomToolbar, {
        props: {
            zoom: 100,
        },
    });
    await expect(component).toContainText('100%');
});
```

## 브라우저 호환성 테스트 {#browser-compatibility-test}

BrowserStack은 서로 다른 브라우저, 운영 체제, 기기, 실제 환경에서 웹 애플리케이션과 모바일 애플리케이션을 테스트하는 다양한 도구와 서비스를 제공하는 클라우드 테스트 플랫폼입니다. 개발자와 QA(품질 보증) 팀은 BrowserStack에서 여러 구성으로 애플리케이션을 테스트하여 호환성, 성능, 사용자 경험을 확인할 수 있습니다.

Babylon.js는 호환성 테스트에 [browserstack-local]을 사용합니다.

## WebWorker에서 렌더링 {#rendering-in-webworker}

서버 쪽 외에도 WebWorker는 특수한 런타임 환경으로 볼 수 있습니다. 렌더링 코드를 WebWorker에서 실행하면 메인 스레드가 막히지 않아 성능이 좋아집니다. 잘 알려진 렌더링 엔진이 사용 사례를 제공합니다.

-   [Three.js OffscreenCanvas]
-   [Babylon.js OffscreenCanvas]

우리의 [WebWorker example]에서는 메인 스레드가 바쁘지 않아 이 방식의 장점이 드러나지 않습니다. 그래도 카메라 확대/축소, 팬, 회전, 도형 피킹 같은 캔버스 상호작용은 경험할 수 있습니다.

### OffscreenCanvas 만들기 {#offscreen-canvas}

먼저 실행 환경이 OffscreenCanvas를 지원하는지 확인해야 합니다. [Can I use OffscreenCanvas?]를 참고하세요.

```ts
if ('OffscreenCanvas' in window && 'transferControlToOffscreen' in mainCanvas) {
    // Ok to use offscreen canvas
}
```

그다음 캔버스가 OffscreenCanvas로부터 생성되는 것을 지원하도록 해야 합니다.

```ts
export interface CanvasConfig {
    canvas: HTMLCanvasElement; // [!code --]
    canvas: HTMLCanvasElement | OffscreenCanvas; // [!code ++]
}
```

메인 스레드 코드는 다음과 같습니다.

1. 먼저 [transferControlToOffscreen]으로 메인 캔버스의 제어권을 OffscreenCanvas로 넘깁니다.
2. Vite가 제공하는 방법으로 WebWorker를 만듭니다. 이 워커는 마우스 스타일 설정처럼 전달되는 메시지를 수신합니다.
3. 보통은 [postMessage]의 첫 번째 매개변수로 WebWorker에 값을 넘기지만, OffscreenCanvas는 [Transferable]이므로 여기서는 두 번째 매개변수를 사용해야 합니다.

```ts
// @see https://vitejs.dev/guide/features.html#import-with-query-suffixes
import Worker from './worker.js?worker&inline';

// 1.
const offscreenCanvas = mainCanvas.transferControlToOffscreen();

// 2.
worker = new Worker();
worker.onmessage = function (event) {
    // TODO: Handle message from WebWorker later.
};

// 3.
worker.postMessage(
    {
        type: 'init',
        offscreenCanvas,
        devicePixelRatio,
        boundingClientRect: mainCanvas.getBoundingClientRect(),
    },
    [offscreenCanvas],
);
```

WebWorker 코드는 다음과 같습니다.

1. 이벤트 객체에서 메인 스레드가 전달한 OffscreenCanvas를 가져옵니다.
2. OffscreenCanvas로 캔버스를 만들고 devicePixelRatio를 설정합니다.
3. 그래픽을 만들어 평소처럼 캔버스에 추가하는 [Render Loop]를 만듭니다.

```ts
// worker.js
self.onmessage = function (event) {
    const { type } = event.data;
    if (type === 'init') {
        // 1.
        const { offscreenCanvas, devicePixelRatio } = event.data;

        (async () => {
            // 2.
            const canvas = await new Canvas({
                canvas: offscreenCanvas,
                devicePixelRatio,
            }).initialized;

            // 3.
            const animate = () => {
                canvas.render();
                self.requestAnimationFrame(animate);
            };
            animate();
        })();
    }
    // ...Handle other messages.
};
```

실제로는 메인 스레드와 WebWorker 사이의 통신을 직접 처리해야 하는 경우가 불가피합니다. 예를 들면 다음과 같습니다.

1. 상호작용 이벤트. [event system]은 DOM API에 의존하지만 WebWorker에서는 DOM API를 쓸 수 없으므로, 메인 스레드 캔버스의 상호작용 이벤트를 수신해 WebWorker에 알려야 합니다.
2. 캔버스 크기 변경. 위와 같습니다.
3. 메인 캔버스의 마우스 스타일을 설정합니다.

### WebWorker의 이벤트 {#events-in-webworker}

`pointerdown` 이벤트를 예로 들면, 메인 캔버스에서 이 이벤트를 수신합니다. 네이티브 Event는 [Transferable]이 아니므로, 직렬화한 뒤 WebWorker에 전달해야 합니다.

```ts
mainCanvas.addEventListener(
    'pointerdown',
    (e) => {
        worker.postMessage({
            type: 'event',
            name: 'pointerdown',
            event: clonePointerEvent(e), // Simple copy of common properties on event objects
        });
    },
    true,
);
```

WebWorker가 이 유형의 메시지를 받으면 해당하는 훅이 바로 호출됩니다.

```ts
self.onmessage = function (event) {
    const { type } = event.data;
    if (type === 'event') {
        const { name, event: ev } = event.data;
        if (name === 'pointerdown') {
            canvas.pluginContext.hooks.pointerDown.call(ev);
        }
    }
};
```

캔버스 크기 변경 이벤트 처리는 위와 같으므로 생략합니다.

### 커서 스타일 설정 {#set-cursor}

렌더링 도중 WebWorker도 메인 스레드에 메시지를 전달해야 합니다. 예를 들면 다음과 같습니다.

-   매 프레임 렌더링이 끝났음을 메인 스레드에 알리고, 실제로 렌더링된 그래픽과 컬링으로 제외된 그래픽의 수 같은 통계를 전달합니다.
-   그래픽이 피킹되었을 때 마우스 스타일을 설정합니다.

```ts
setCursor: (cursor) => {
    self.postMessage({ type: 'cursor', cursor });
},
```

메인 스레드는 메시지를 받아 캔버스의 마우스 스타일을 설정합니다.

```ts
worker.onmessage = function (event) {
    if (event.data.type === 'cursor') {
        mainCanvas.style.cursor = event.data.cursor;
    }
};
```

어쨌든 WebWorker에서 캔버스를 렌더링하려면 메인 스레드와의 통신을 추가로 처리해야 합니다. 상호작용 이벤트, 스타일, UI 컴포넌트 모두에 대응하는 이벤트를 설계해야 합니다. 대부분의 웹 3D 렌더링 엔진이 간단한 예제나 지침만 제공하는 이유도 여기에 있다고 봅니다.

## 더 읽어보기 {#extended-reading}

-   [How can I use headless-gl with a continuous integration service?]
-   [Playwright Components (experimental)]
-   [Canvas Lambda Layer]

[node-canvas]: https://github.com/Automattic/node-canvas
[headless-gl]: https://github.com/stackgl/headless-gl
[jsdom]: https://github.com/jsdom/jsdom
[Lit Testing]: https://lit.dev/docs/tools/testing/
[transformIgnorePatterns]: https://jestjs.io/docs/configuration#transformignorepatterns-arraystring
[d3-color issue in recharts]: https://github.com/recharts/recharts/commit/bcb199c0d60b79fa09704413ed9a440cc0a7b1c9
[victory-vendor]: https://www.npmjs.com/package/victory-vendor
[Three.js Puppeteer]: https://github.com/mrdoob/three.js/blob/dev/test/e2e/puppeteer.js
[Move visualization testing to playwright]: https://github.com/BabylonJS/Babylon.js/pull/15149
[Register devices]: https://github.com/visgl/luma.gl/blob/master/modules/test-utils/src/register-devices.ts#L7
[pixelmatch]: https://github.com/mapbox/pixelmatch
[sharding]: https://playwright.dev/docs/test-sharding
[d3-selector]: https://github.com/d3/d3-selection/blob/main/src/creator.js#L6
[mocha + JSDOM]: https://github.com/observablehq/plot/blob/main/test/jsdom.js
[Can I use OffscreenCanvas?]: https://caniuse.com/#feat=offscreencanvas
[react-reconciler]: https://www.npmjs.com/package/react-reconciler
[Environment API]: https://github.com/vitejs/vite/discussions/16358
[Transferable]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
[postMessage]: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
[Three.js OffscreenCanvas]: https://threejs.org/examples/webgl_worker_offscreencanvas.html
[Babylon.js OffscreenCanvas]: https://doc.babylonjs.com/features/featuresDeepDive/scene/offscreenCanvas
[transferControlToOffscreen]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/transferControlToOffscreen
[Render Loop]: /ko/guide/lesson-001#design-the-canvas-api
[event system]: /ko/guide/lesson-006
[WebWorker example]: /example/webworker
[readPixels]: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/readPixels
[toMatchWebGLSnapshot.ts]: https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/__tests__/toMatchWebGLSnapshot.ts
[toMatchSVGSnapshot.ts]: https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/__tests__/toMatchSVGSnapshot.ts
[xmlserializer]: https://www.npmjs.com/package/xmlserializer
[github workflows - test]: https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/.github/workflows/test.yml
[How can I use headless-gl with a continuous integration service?]: https://github.com/stackgl/headless-gl?tab=readme-ov-file#how-can-i-use-headless-gl-with-a-continuous-integration-service
[Drag & Drop Plugin]: /ko/guide/lesson-006#dragndrop-plugin
[E2E action]: https://github.com/xiaoiver/infinite-canvas-tutorial/actions/runs/10282078732
[\_\_tests\_\_]: https://github.com/xiaoiver/infinite-canvas-tutorial/tree/master/__tests__
[Visual comparisons]: https://playwright.dev/docs/test-snapshots
[Playwright Web component testing]: https://github.com/sand4rt/playwright-ct-web
[Playwright Components (experimental)]: https://playwright.dev/docs/test-components
[Web Components]: /ko/guide/lesson-007
[browserstack-local]: https://github.com/browserstack/browserstack-local-nodejs
[Canvas Lambda Layer]: https://github.com/ShivamJoker/Canvas-Lambda-Layer
