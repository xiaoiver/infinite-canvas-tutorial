---
outline: deep
description: 'カメラの概念、投影変換、カメラ変換を理解します。ランドマーク遷移を伴うカメラアニメーションと、パン、回転、ズームのための対話的な操作を実装します。'
head:
    - ['meta', { property: 'og:title', content: '第4課 - カメラ' }]
---

# 第 4 課 - カメラ {#lesson-4-camera}

この課では、次のことを学びます。

-   カメラとは何でしょうか。
-   投影変換。
-   カメラ変換。
-   カメラアニメーション。異なるカメラ状態の間を Landmark で遷移します。

カメラを制御することで、キャンバスに表示される内容を変えられます。マウスをクリックしてドラッグするとパンできます。<kbd>Shift</kbd> を押したままドラッグすると、指定した点の周りを回転できます。マウスホイールを使うと、指定した点を基準にズームインとズームアウトができます。ボタンを押すと、滑らかな遷移効果とともに初期状態へ戻ります。

```js eval code=false
$button = call(() => {
    const $button = document.createElement('button');
    $button.textContent = 'FlyTo origin';
    return $button;
});
```

```js eval code=false
(async () => {
    const { Canvas, Circle, Group } = Lesson4;
    const canvas = await Utils.createCanvas(Canvas, 400, 400);

    const solarSystem = new Group();
    const earthOrbit = new Group();
    const moonOrbit = new Group();

    const sun = new Circle({
        cx: 0,
        cy: 0,
        r: 100,
        fill: 'red',
    });
    const earth = new Circle({
        cx: 0,
        cy: 0,
        r: 50,
        fill: 'blue',
    });
    const moon = new Circle({
        cx: 0,
        cy: 0,
        r: 25,
        fill: 'yellow',
    });
    solarSystem.appendChild(sun);
    solarSystem.appendChild(earthOrbit);
    earthOrbit.appendChild(earth);
    earthOrbit.appendChild(moonOrbit);
    moonOrbit.appendChild(moon);

    solarSystem.position.x = 200;
    solarSystem.position.y = 200;
    earthOrbit.position.x = 100;
    moonOrbit.position.x = 100;

    canvas.appendChild(solarSystem);

    let id;
    const animate = () => {
        solarSystem.rotation += 0.01;
        earthOrbit.rotation += 0.02;
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });

    const landmark = canvas.camera.createLandmark({
        x: 0,
        y: 0,
        zoom: 1,
        rotation: 0,
    });
    $button.onclick = () => {
        canvas.camera.gotoLandmark(landmark, {
            duration: 1000,
            easing: 'ease',
        });
    };

    return canvas.getDOM();
})();
```

## カメラとは {#what-is-a-camera}

カメラは、世界を見る角度を表します。焦点とカメラの位置は、どちらも最終的な画像に影響します。2D と 3D のどちらのシーンにも適用できます。カメラを制御すれば、以前はキャンバス全体を動かす必要があった一部の操作を簡単に行え、カメラアニメーションも実現できます。次の図は [WebGL 3D - Cameras] からのもので、俯瞰した XZ 平面の内容を示しています。同じ視覚効果を得るなら、カメラを動かす（左の図）ほうが、キャンバス内のすべてのオブジェクトを回転させる（右の図）よりも直感的で、実装上の性能も高くなります。この点はすぐに分かります。

![カメラを動かす場合とオブジェクトを動かす場合](/camera.png)

キャンバスは XY 平面上にあり、カメラは画面の外側から内側に向かってそれを観察します。次の画像の出典は [How to Create a Figma-like Infinite Canvas in WebGL] です。キャンバスを左へパンしたいとき、対応するカメラの移動は右へのパンです。

![キャンバス上の領域に対するカメラの投影](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*59IngIJ4xqwC629qD89APA.png)

オブジェクトをモデル空間からスクリーン空間へ変換する各段階を振り返りましょう。前の課ではモデル変換を紹介しました。この課では、投影変換とカメラ変換を扱います。

![座標系](/coordinates.png)

## 投影変換 {#projection-transformation}

以前扱った、ピクセル空間からクリップ空間への変換をまず振り返りましょう。

```glsl
// Pixel space to [0, 1] (Screen space)
vec2 zeroToOne = position / u_Resolution;

// Convert from [0, 1] to [0, 2]
vec2 zeroToTwo = zeroToOne * 2.0;

// Convert from [0, 2] to [-1, 1] (NDC/clip space)
vec2 clipSpace = zeroToTwo - 1.0;

// Flip Y axis
gl_Position = vec4(clipSpace * vec2(1, -1), 0.0, 1.0);
```

1 回の投影変換で済ませられれば、コードはずっと簡潔になります。例えば、モデル変換行列を左から直接掛けることができます。

```glsl
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
};

gl_Position = vec4((u_ProjectionMatrix
    * u_ModelMatrix
    * vec3(position, 1)).xy, 0, 1);
```

2D の投影変換は、とても簡単に実装できます。必要なのは `width` と `height` を渡すことだけです。シェーダー内で `u_Resolution` により割る処理は、ここでの `/ width` と `/ height` に対応します。

```ts
[2 / width, 0, 0, 0, -2 / height, 0, -1, 1, 1];
```

[gl-matrix] が提供する `projection` メソッドを直接使います。興味があれば、ソースコードを見てください。実装はまったく同じです。キャンバスのサイズが変わったときも、再計算のためにこのメソッドを再度呼び出す必要があります。

```ts
export class Camera {
    #projectionMatrix = mat3.create();

    get projectionMatrix() {
        return this.#projectionMatrix;
    }

    projection(width: number, height: number) {
        mat3.projection(this.#projectionMatrix, width, height);
    }
}
```

ただし、`projectionMatrix` を直接渡すことはできません。前の課で触れた [alignment issue] があるためです。シェーダーへ渡す前に、`mat3` へパディングを追加する必要があります。

```ts
export function paddingMat3(matrix: mat3) {
    return [
        matrix[0],
        matrix[1],
        matrix[2],
        0,
        matrix[3],
        matrix[4],
        matrix[5],
        0,
        matrix[6],
        matrix[7],
        matrix[8],
        0,
    ];
}
```

最後に、キャンバスの初期化と同時にカメラを作成します。その後は `canvas.camera` からアクセスできます。

```ts
export class Canvas {
    #camera: Camera;
    get camera() {
        return this.#camera;
    }

    constructor() {
        const camera = new Camera(width / dpr, height / dpr);
        this.#camera = camera;
    }
}
```

では、平行移動のようなカメラ変換の問題を考えましょう。

## カメラ変換 {#camera-transformation}

カメラ変換も行列で表せます。変換が終わったら、シェーダー内で次のように使えます。各図形についてモデル変換行列 `u_ModelMatrix` を計算して更新するのに比べ、カメラ変換行列をグローバルに 1 回更新するほうが効率的です。

```glsl{3}
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
  mat3 u_ViewMatrix;
};

gl_Position = vec4((u_ProjectionMatrix
    * u_ViewMatrix
    * u_ModelMatrix
    * vec3(position, 1)).xy, 0, 1);
```

カメラ変換行列は、ワールド座標系におけるカメラの変換の逆行列であるべきです。冒頭の例で述べたように、カメラが右へ動くことは、シーンが左へ動くことに対応します。ここでは [gl-matrix] が提供する `invert` メソッドを使って逆行列を計算します。同時に、後で使うため、`projectionMatrix * viewMatrix` のような他の getter も追加します。

```ts{4}
export class Camera {
  #matrix = mat3.create();
  private updateMatrix() {
    mat3.invert(this.#viewMatrix, this.#matrix);
    this.updateViewProjectionMatrix();
  }

  get viewMatrix() {
    return this.#viewMatrix;
  }

  get viewProjectionMatrix() {
    return this.#viewProjectionMatrix;
  }

  get viewProjectionMatrixInv() {
    return this.#viewProjectionMatrixInv;
  }
}
```

### 平行移動 {#translation}

[infinitecanvas] における無限キャンバスの定義では、「拡張性」はキャンバスレベルの平行移動として現れます。

![拡張するキャンバス](https://infinitecanvas.tools/images/illustrations/expansive.svg)

では、基本的なカメラ機能を実装しましょう。3D カメラに比べるとずっと単純で、平行移動の `x/y`、回転の `rotation`、拡大縮小の `zoom` をサポートします。命名に `scaling` を使わないのは、`zoom` のほうがよく使われるからです（例えば Three.js の [OrthographicCamera.zoom]）。

```ts
export class Camera {
    #zoom = 1;
    #x = 0;
    #y = 0;
    #rotation = 0;

    private updateMatrix() {
        const zoomScale = 1 / this.#zoom;
        mat3.identity(this.#matrix);
        mat3.translate(this.#matrix, this.#matrix, [this.#x, this.#y]);
        mat3.rotate(this.#matrix, this.#matrix, this.#rotation);
        mat3.scale(this.#matrix, this.#matrix, [zoomScale, zoomScale]);
        mat3.invert(this.#viewMatrix, this.#matrix);
        this.updateViewProjectionMatrix();
    }
}
```

`camera.x += 100;` でカメラを平行移動するときは、カメラ行列を再計算する必要があります。

```ts
export class Camera {
    set x(x: number) {
        if (this.#x !== x) {
            this.#x = x;
            this.updateMatrix();
        }
    }
}
```

スライダーをドラッグして、カメラを動かしてみてください。

```js eval code=false inspector=false
canvas = call(() => {
    const { Canvas } = Lesson4;
    return Utils.createCanvas(Canvas, 400, 400);
});
```

```js eval code=false
positionX = Inputs.range([0, 100], { label: 'camera.x', value: 0, step: 1 });
```

```js eval code=false
positionY = Inputs.range([0, 100], { label: 'camera.y', value: 0, step: 1 });
```

```js eval code=false inspector=false
call(() => {
    const camera = canvas.camera;
    camera.x = positionX;
    camera.y = positionY;
});
```

```js eval code=false
(async () => {
    const { Circle, Group } = Lesson4;
    canvas.getDOM().style.pointerEvents = 'none';

    const solarSystem = new Group();
    const earthOrbit = new Group();
    const moonOrbit = new Group();

    const sun = new Circle({
        cx: 0,
        cy: 0,
        r: 100,
        fill: 'red',
    });
    const earth = new Circle({
        cx: 0,
        cy: 0,
        r: 50,
        fill: 'blue',
    });
    const moon = new Circle({
        cx: 0,
        cy: 0,
        r: 25,
        fill: 'yellow',
    });
    solarSystem.appendChild(sun);
    solarSystem.appendChild(earthOrbit);
    earthOrbit.appendChild(earth);
    earthOrbit.appendChild(moonOrbit);
    moonOrbit.appendChild(moon);

    solarSystem.position.x = 200;
    solarSystem.position.y = 200;
    earthOrbit.position.x = 100;
    moonOrbit.position.x = 100;

    canvas.appendChild(solarSystem);

    let id;
    const animate = () => {
        solarSystem.rotation += 0.01;
        earthOrbit.rotation += 0.02;
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });
    return canvas.getDOM();
})();
```

良さそうです。マウスのドラッグで操作できれば、さらに直感的になります。

### プラグインを実装する {#implement-a-plugin}

この機能はプラグインで実装することにします。

```ts{3}
export class CameraControl implements Plugin {}

[new CameraControl(), new Renderer()].forEach((plugin) => {
  plugin.apply(this.#pluginContext);
});
```

[How to implement zoom from mouse in 2D WebGL] を参考に、マウスイベントオブジェクトに含まれる座標を、キャンバス座標からクリップ空間の座標へ変換します。

```ts
function getClipSpaceMousePosition(e: MouseEvent): vec2 {
    // CSS space
    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;

    // Normalize to [0, 1]
    const normalizedX = cssX / canvas.clientWidth;
    const normalizedY = cssY / canvas.clientHeight;

    // Convert to clipspace
    const clipX = normalizedX * 2 - 1;
    const clipY = normalizedY * -2 + 1;

    return [clipX, clipY];
}
```

次に `mousedown` イベントを監視し、それに続く `mousemove` と `mouseup` のイベントを処理します。これらはグローバルではありません。

```ts
canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // the invert matrix of vp matrix
    mat3.copy(startInvertViewProjectionMatrix, camera.viewProjectionMatrixInv);
    // camera postion in world space
    startCameraX = camera.x;
    startCameraY = camera.y;
    // convert mouse position to world space
    startPos = vec2.transformMat3(
        startPos,
        getClipSpaceMousePosition(e),
        startInvViewProjMatrix,
    );
});
```

次の変数を記録する必要があります。

-   `startInvViewProjMatrix` - カメラの投影行列の逆行列
-   `startCameraX` - ワールド空間におけるカメラの X 座標
-   `startCameraY` - ワールド空間におけるカメラの Y 座標
-   `startPos` - ワールド空間における現在のマウス位置。NDC（正規化デバイス座標）空間の座標を、カメラの投影行列の逆行列で変換して得ます

マウスを離すとイベントリスナーを解除し、ドラッグ操作は終了します。

```ts
function handleMouseUp(e) {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
}
```

マウスが動くと、カメラも動きます。同様に、ワールド空間の座標へ変換する必要があります。その後、現在のマウス位置を、直前の `mousedown` で保存したマウス位置から引き、移動した距離を求めます。

```ts
function handleMouseMove(e: MouseEvent) {
    moveCamera(e);
}

function moveCamera(e: MouseEvent) {
    const pos = vec2.transformMat3(
        vec2.create(),
        getClipSpaceMousePosition(e),
        startInvertViewProjectionMatrix,
    );

    camera.x = startCameraX + startPos[0] - pos[0];
    camera.y = startCameraY + startPos[1] - pos[1];
}
```

このページ上部の例で、キャンバスをドラッグしてみてください。

ECS のキャンバスは、マウスホイールや 2 本指のタッチジェスチャーでもパンします。これらの差分はビューポートのピクセルで測られます。カメラ位置を変える前に、現在の回転に合わせてワールド空間へ変換し、現在のズームで割ります。タッチ移動ではカメラの差分を逆向きにし、キャンバスが指に追従するようにします。同じフレームでピンチがズームを変える場合は、更新後のカメラ変換にパンを適用します。

### 回転 {#rotation}

回転はキャンバスに不可欠な機能ではありませんが、FigJam のユーザーがかつてフォーラムで、対応しているかを尋ねたことがあります。[Rotate canvas]。キャンバスを少し回転させたほうが、普段の使い方に合うためです。

<kbd>Shift</kbd> キーを押したままマウスをドラッグすることで、キャンバスを回転できるようにします。`mousedown` のイベントリスナーでは、[KeyboardEvent: shiftKey] を確認して、回転モードに入るかどうかを判断できます。

```ts{2}
canvas.addEventListener('mousedown', (e) => {
  rotate = e.shiftKey;
});

function handleMouseMove(e: MouseEvent) {
  if (rotate) {
    rotateCamera(e);
  } else {
    moveCamera(e);
  }
}
```

カメラの回転モードでは、マウスが移動した距離を回転角とします。次に、ワールド座標系において指定した点を中心とする回転の変換行列を作ります。これは [transform-origin] を参考にできます。その後、この変換をカメラ行列へ適用し、最後に行列から各パラメータを取り出します。

ポインタを押したときの座標は、独立した値として保存します。フレームをまたいで ECS の入力ベクトルを生きた参照のまま保持すると、回転ジェスチャーが無効になることがあります。

```ts
function rotateCamera(e: MouseEvent) {
    // convert moved distance to rotation
    const delta = (e.clientX - startMousePos[0]) / 100;

    // create matrix with pivot
    const camMat = mat3.create();
    mat3.translate(camMat, camMat, [startPos[0], startPos[1]]);
    mat3.rotate(camMat, camMat, delta);
    mat3.translate(camMat, camMat, [-startPos[0], -startPos[1]]);

    // apply transformation
    camera.x = startCameraX;
    camera.y = startCameraY;
    camera.rotation = startCameraRotation;
    mat3.multiply(camMat, camMat, camera.matrix);

    // Reset camera params
    camera.x = camMat[6];
    camera.y = camMat[7];
    camera.rotation = startCameraRotation + delta;
}
```

ページ上部の例に戻り、<kbd>Shift</kbd> を押したままキャンバスをドラッグしてみてください。

### 指定点を中心にズーム {#rotate-around-pivot}

無限キャンバスでは、パン以外にもズームは非常によく行う操作です。特に、特定の点を中心にしたズームがよく使われます。

![無限キャンバスでのズーム](https://infinitecanvas.tools/images/illustrations/zoom.svg)

`wheel` イベントを監視します。まず、ズーム前のマウス位置を記録します。ズームしてカメラ行列を更新したあと、位置の差を計算します。この差が、カメラが移動する必要のある距離です。

```ts
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const position = getClipSpaceMousePosition(e);

    // mouse position in world space before zooming
    const [preZoomX, preZoomY] = vec2.transformMat3(
        vec2.create(),
        position,
        camera.viewProjectionMatrixInv,
    );

    // calculate zoom factor
    const newZoom = camera.zoom * Math.pow(2, e.deltaY * -0.01);
    camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));

    // mouse position in world space after zooming
    const [postZoomX, postZoomY] = vec2.transformMat3(
        vec2.create(),
        position,
        camera.viewProjectionMatrixInv,
    );

    // move camera
    camera.x += preZoomX - postZoomX;
    camera.y += preZoomY - postZoomY;
});
```

### PointerEvent {#pointerevent}

ここまで監視してきたのは [MouseEvent] です。今後、イベントシステムを実装するときに [PointerEvent] を紹介します。そのとき戻ってきて、`CameraControl` プラグインのイベントリスナー部分のコードを修正し、タッチスクリーンなどの入力デバイスに対応させます。

![PointerEvent](https://gw.alipayobjects.com/mdn/rms_6ae20b/afts/img/A*FtyaTL5gzv4AAAAAAAAAAAAAARQnAQ)

では次の話題へ進みましょう。カメラの動きをより自然にする方法です。

## カメラアニメーション {#camera-animation}

Mapbox は [flyTo - Mapbox] メソッドを提供しており、異なる地点の間を滑らかに移動できます。[WebGL Insights - 23.Designing Cameras for WebGL Applications] を参考にしてカメラアニメーションを実装し、任意のカメラ状態の間を滑らかに遷移できるようにします。

![ランドマーク](https://xiaoiver.github.io/assets/img/webgl/landmark.png)

関連 API の想定される使い方は、次のとおりです。

1. `Landmark` を作成します。これはカメラの現在の状態を表すことができ、位置、回転角、スケールなどのパラメータを設定することもできます。
2. カメラを現在の状態から指定した `Landmark` へ遷移させます。その過程には、滑らかな遷移効果が含まれます。

```ts
const landmark = camera.createLandmark({ zoom: 2 });
camera.gotoLandmark(landmark, { duration: 300 });
```

### Landmark を作成する {#create-landmark}

`Landmark` はカメラの状態を保存する必要があります。

```ts
export interface Landmark {
    zoom: number;
    x: number;
    y: number;
    rotation: number;
}
```

`Landmark` の作成は、カメラのパラメータを保存するだけです。ユーザーが値を渡した場合は、それで上書きされます。

```ts
export class Camera {
    createLandmark(params: Partial<Landmark>): Landmark {
        return {
            zoom: this.#zoom,
            x: this.#x,
            y: this.#y,
            rotation: this.#rotation,
            ...params,
        };
    }
}
```

### アニメーション効果 {#animation-effects}

[bezier-easing] を使って、[Cubic Bézier easing functions] を実装します。

```ts
import BezierEasing from 'bezier-easing';
export const EASING_FUNCTION = {
    linear: BezierEasing(0, 0, 1, 1),
    ease: BezierEasing(0.25, 0.1, 0.25, 1),
    'ease-in': BezierEasing(0.42, 0, 1, 1),
    'ease-out': BezierEasing(0, 0, 0.58, 1),
    'ease-in-out': BezierEasing(0.42, 0, 0.58, 1),
};
```

では、`Landmark` へ切り替える API を設計しましょう。[Web Animations API] を参考に、次のパラメータをサポートします。

-   `easing` は `ease` と `linear` をサポートし、CSS と同じです
-   `duration` に `0` を渡すと、アニメーションをスキップします。
-   `onframe` アニメーション中の各フレームでのコールバック
-   `onfinish` アニメーション終了時のコールバック

```ts
export class Camera {
    gotoLandmark(
        landmark: Landmark,
        options: Partial<{
            easing: string;
            duration: number;
            onframe: (t: number) => void;
            onfinish: () => void;
        }> = {},
    ) {}
}
```

`duration` に `0` を渡した場合、アニメーション効果はありません。`Landmark` に含まれるカメラパラメータで直接更新し、終了コールバックを呼び出します。

```ts{14}
const { zoom, x, y, rotation } = landmark;

const endAnimation = () => {
  this.#zoom = zoom;
  this.#x = x;
  this.#y = y;
  this.#rotation = rotation;
  this.updateMatrix();
  if (onfinish) {
    onfinish();
  }
};

if (duration === 0) {
  endAnimation();
  return;
}
```

新しいアニメーションを開始する前に、進行中のアニメーションがあれば停止します。次に、アニメーション中の各フレームのロジックを実装します。`duration` を超えたら、アニメーションは直ちに終了します。

```ts{11}
this.cancelLandmarkAnimation();

let timeStart: number | undefined;
const startPosition: vec2 = [this.#x, this.#y];
const startZoomRotation: vec2 = [this.zoom, this.#rotation];
const destPosition: vec2 = [x, y];
const destZoomRotation: vec2 = [zoom, rotation];
const animate = (timestamp: number) => {
  if (timeStart === undefined) {
    timeStart = timestamp;
  }
  const elapsed = timestamp - timeStart;
  if (elapsed > duration) {
    endAnimation();
    return;
  }

  // Omit calculation for now.

  if (elapsed < duration) {
    if (onframe) {
      onframe(t);
    }
    this.#landmarkAnimationID = requestAnimationFrame(animate);
  }
};
requestAnimationFrame(animate);
```

以前定義したイージング関数で時刻の値を得ます。次に `vec2.lerp` で補間し、現在のカメラパラメータを求めます。最後にそれを適用して、カメラ行列を更新します。

```ts
// use the same ease function in animation system
const t = EASING_FUNCTION[easing](elapsed / duration);

const interPosition = vec2.create();
const interZoomRotation = vec2.fromValues(1, 0);

vec2.lerp(interPosition, startPosition, destPosition, t);
vec2.lerp(interZoomRotation, startZoomRotation, destZoomRotation, t);

this.#x = interPosition[0];
this.#y = interPosition[1];
this.#zoom = interZoomRotation[0];
this.#rotation = interZoomRotation[1];
this.updateMatrix();
```

アニメーションが始まるときに、開始状態を一度だけ取得します。毎フレーム、更新後のカメラ状態から補間すると、イージング曲線が変わり、結果がフレームレートに依存します。アニメーションを早期に終了できるのは、位置とズーム／回転の両方が目的地へ到達したときだけです。位置だけを確認すると、ズームだけのアニメーションを飛ばしてしまいます。

```ts
if (
    vec2.dist(interPosition, destPosition) <= EPSILON &&
    vec2.dist(interZoomRotation, destZoomRotation) <= EPSILON
) {
    endAnimation();
    return;
}
```

ページ上部の例に戻って試してください。ボタンをクリックすると、カメラが初期状態に戻ります。

## さらに読む {#extended-reading}

-   [WebGL Insights - 23.Designing Cameras for WebGL Applications]
-   [LearnWebGL - Introduction to Cameras]
-   [WebGL 3D - Cameras]

[LearnWebGL - Introduction to Cameras]: https://learnwebgl.brown37.net/07_cameras/camera_introduction.html#a-camera-definition
[How to Create a Figma-like Infinite Canvas in WebGL]: https://betterprogramming.pub/how-to-create-a-figma-like-infinite-canvas-in-webgl-8be94f65674f
[WebGL Insights - 23.Designing Cameras for WebGL Applications]: https://github.com/lnickers2004/WebGL-Insights
[WebGL 3D - Cameras]: https://webglfundamentals.org/webgl/lessons/webgl-3d-camera.html
[How to implement zoom from mouse in 2D WebGL]: https://webglfundamentals.org/webgl/lessons/webgl-qna-how-to-implement-zoom-from-mouse-in-2d-webgl.html
[gl-matrix]: https://github.com/toji/gl-matrix
[alignment issue]: /ja/guide/lesson-003.html#alignment
[OrthographicCamera.zoom]: https://threejs.org/docs/#api/en/cameras/OrthographicCamera.zoom
[Rotate canvas]: https://forum.figma.com/t/rotate-canvas/42818
[infinitecanvas]: https://infinitecanvas.tools
[KeyboardEvent: shiftKey]: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/shiftKey
[MouseEvent]: https://developer.mozilla.org/zh-CN/docs/Web/API/MouseEvent
[PointerEvent]: https://developer.mozilla.org/zh-CN/docs/Web/API/PointerEvent
[transform-origin]: https://developer.mozilla.org/en-US/docs/Web/CSS/transform-origin
[flyTo - Mapbox]: https://docs.mapbox.com/mapbox-gl-js/example/flyto/
[bezier-easing]: https://github.com/gre/bezier-easing
[Cubic Bézier easing functions]: https://www.w3.org/TR/css-easing-1/#cubic-bezier-easing-functions
[Web Animations API]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API
