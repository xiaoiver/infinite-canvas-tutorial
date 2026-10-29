---
outline: deep
description: 'Entenda os conceitos de câmera, as transformações de projeção e as transformações de câmera. Implemente animações de câmera com transições por Landmark e controles interativos de pan, rotação e zoom.'
head:
    - ['meta', { property: 'og:title', content: 'Lição 4 - Câmera' }]
---
# Lição 4 - Câmera {#lesson-4-camera}

Nesta lição, você vai aprender o seguinte:

-   O que é uma câmera?
-   Transformação de projeção.
-   Transformação de câmera.
-   Animação de câmera. Usar uma transição com Landmark entre diferentes estados da câmera.

Podemos mudar o conteúdo exibido na tela controlando a câmera. Clicar e arrastar o mouse permite fazer pan; segurar <kbd>Shift</kbd> e arrastar permite girar em torno de um ponto especificado; usar a roda do mouse permite ampliar e reduzir o zoom em um ponto especificado. Pressionar o botão restaura o estado inicial, com um efeito de transição suave.

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

## O que é uma câmera? {#what-is-a-camera}

A câmera descreve o ângulo a partir do qual vemos o mundo. O ponto focal e a posição da câmera afetam a imagem final. Isso se aplica tanto a cenas 2D quanto a cenas 3D. Ao controlar a câmera, conseguimos fazer com facilidade certas operações que antes exigiam mover a tela inteira, e ainda podemos obter animações de câmera. O diagrama a seguir, de [WebGL 3D - Cameras], mostra o conteúdo do plano XZ em vista superior. Se você quiser o mesmo efeito visual, mover a câmera (imagem à esquerda), em vez de girar todos os objetos dentro da tela inteira (imagem à direita), é mais intuitivo e tem melhor desempenho na implementação. Vamos ver isso em breve:

![Mover a câmera em vez de mover os objetos](/camera.png)

Nossa tela está situada no plano XY, e a câmera a observa de fora do monitor, olhando para dentro. A imagem a seguir vem de: [How to Create a Figma-like Infinite Canvas in WebGL]. Quando queremos deslocar a tela para a esquerda, o movimento correspondente da câmera é um pan para a direita:

![A projeção da câmera de uma região na tela](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*59IngIJ4xqwC629qD89APA.png)

Vamos revisar os vários estágios da transformação de um objeto, do espaço do modelo ao espaço de tela. Na lição anterior, apresentamos as transformações de modelo. Nesta lição, vamos discutir as transformações de projeção e as transformações de câmera.

![coordenadas](/coordinates.png)

## Transformação de projeção {#projection-transformation}

Vamos primeiro revisar a transformação do espaço de pixels para o espaço de recorte que vimos antes:

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

Se conseguirmos concluí-la com uma única transformação de projeção, o código fica bem mais enxuto. Por exemplo, poderíamos multiplicar diretamente, à esquerda, pela matriz de transformação do modelo:

```glsl
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
};

gl_Position = vec4((u_ProjectionMatrix
    * u_ModelMatrix
    * vec3(position, 1)).xy, 0, 1);
```

A transformação de projeção 2D é muito fácil de implementar; você só precisa informar `width` e `height`. A divisão por `u_Resolution` no shader corresponde a `/ width` e `/ height` aqui:

```ts
[2 / width, 0, 0, 0, -2 / height, 0, -1, 1, 1];
```

Usamos diretamente o método `projection` fornecido pelo [gl-matrix]. Se tiver interesse, você pode ver o código-fonte, pois a implementação é exatamente a mesma. Esse método também precisa ser chamado de novo para recalcular quando a tela é redimensionada.

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

No entanto, não podemos passar a `projectionMatrix` diretamente por causa do [problema de alinhamento] que mencionamos na lição anterior. Precisamos adicionar padding à `mat3` antes de passá-la ao shader:

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

Por fim, criamos a câmera em sincronia com a inicialização da tela. Em seguida, podemos acessá-la por meio de `canvas.camera`:

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

Agora vamos considerar a questão das transformações de câmera, como a translação.

## Transformação de câmera {#camera-transformation}

As transformações de câmera também podem ser representadas por matrizes. Depois de concluir as transformações, podemos usá-las no shader da seguinte forma. Em comparação com calcular e atualizar a matriz de transformação do modelo `u_ModelMatrix` de cada gráfico, uma atualização global e única da matriz de transformação da câmera é mais eficiente:

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

A matriz de transformação da câmera deve ser a inversa da transformação da câmera no sistema de coordenadas do mundo. Como no exemplo do início, quando a câmera se move para a direita, isso corresponde à cena se movendo para a esquerda. Aqui usamos o método `invert` fornecido pelo [gl-matrix] para calcular a matriz inversa. Ao mesmo tempo, adicionamos outros getters, como `projectionMatrix * viewMatrix`, para uso posterior:

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

### Translação {#translation}

Na definição de tela infinita do [infinitecanvas], a "extensibilidade" se manifesta pela translação no nível da tela:

![tela expansiva](https://infinitecanvas.tools/images/illustrations/expansive.svg)

Agora, vamos implementar a funcionalidade básica da câmera. Em comparação com uma câmera 3D, ela é bem mais simples e oferece translação `x/y`, rotação `rotation` e escala `zoom`. O motivo de não usar `scaling` como nome é que `zoom` é mais comum (por exemplo, o [OrthographicCamera.zoom] do Three.js):

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

Quando transladamos a câmera com `camera.x += 100;`, precisamos recalcular a matriz da câmera:

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

Experimente arrastando o Slider para mover a câmera:

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

Ficou bom. Ficaria ainda mais intuitivo se você pudesse interagir arrastando com o mouse.

### Implementar um plugin {#implement-a-plugin}

Decidimos implementar esse recurso por meio de um plugin:

```ts{3}
export class CameraControl implements Plugin {}

[new CameraControl(), new Renderer()].forEach((plugin) => {
  plugin.apply(this.#pluginContext);
});
```

Com base em [How to implement zoom from mouse in 2D WebGL], convertemos as coordenadas contidas no objeto de evento do mouse, das coordenadas da tela para as coordenadas do espaço de recorte:

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

Em seguida, escutamos o evento `mousedown` e tratamos os eventos seguintes, `mousemove` e `mouseup`, que não são globais.

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

Precisamos registrar as seguintes variáveis:

-   `startInvViewProjMatrix` - a matriz inversa da matriz de projeção da câmera
-   `startCameraX` - a coordenada X da câmera no espaço do mundo
-   `startCameraY` - a coordenada Y da câmera no espaço do mundo
-   `startPos` - a posição atual do mouse no espaço do mundo, obtida ao transformar as coordenadas no espaço NDC (Normalized Device Coordinates) pela inversa da matriz de projeção da câmera

Quando o mouse é solto, desvinculamos os listeners de evento, o que encerra a interação de arrastar.

```ts
function handleMouseUp(e) {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
}
```

Quando o mouse se move, a câmera também se move. Da mesma forma, é preciso converter para coordenadas do espaço do mundo. Em seguida, subtrai-se a posição atual do mouse da posição do mouse salva no `mousedown` anterior, obtendo a distância percorrida.

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

Você pode tentar arrastar a tela no exemplo no topo desta página.

A tela ECS também faz pan com a roda do mouse ou com um gesto de toque de dois dedos. Esses deltas são medidos em pixels do viewport: rotacione-os para o espaço do mundo e divida pelo zoom atual antes de alterar a posição da câmera. O movimento de toque usa o delta oposto da câmera, para que a tela acompanhe os dedos. Se um gesto de pinça mudar o zoom no mesmo quadro, aplique o pan à transformação de câmera já atualizada.

### Rotação {#rotation}

A rotação não é um recurso essencial da tela, mas um usuário do FigJam certa vez perguntou nos fóruns sobre o suporte a ela: [Rotate canvas], pois uma leve rotação da tela combina mais com os hábitos de uso dessa pessoa.

Pretendemos facilitar a rotação da tela segurando a tecla <kbd>Shift</kbd> enquanto o mouse é arrastado. No listener do evento `mousedown`, podemos determinar se entramos no modo de rotação verificando [KeyboardEvent: shiftKey]:

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

No modo de rotação da câmera, a distância percorrida pelo mouse é tomada como o ângulo de rotação. Em seguida, construímos uma matriz de transformação para girar em torno de um ponto especificado no sistema de coordenadas do mundo; isso pode ser consultado em [transform-origin]. Depois, essa transformação é aplicada à matriz da câmera e, por fim, os vários parâmetros são extraídos da matriz:

Salve as coordenadas do pointer-down como um valor independente; manter um vetor de entrada ativo do ECS entre os quadros pode invalidar o gesto de rotação.

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

Você pode voltar ao exemplo no topo da página e tentar segurar <kbd>Shift</kbd> e arrastar a tela.

### Girar em torno do pivô {#rotate-around-pivot}

Em uma tela infinita, além do pan, o zoom também é uma operação muito comum, especialmente o zoom em torno de um ponto específico:

![zoom em uma tela infinita](https://infinitecanvas.tools/images/illustrations/zoom.svg)

Escute o evento `wheel`, registrando primeiro a posição do mouse antes do zoom. Depois de aplicar o zoom e atualizar a matriz da câmera, calcule a diferença entre as posições. Essa diferença é a distância que a câmera precisa percorrer:

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

Até aqui, temos escutado [MouseEvent]. No futuro, quando implementarmos o sistema de eventos, vamos introduzir [PointerEvent]. Nesse momento, voltaremos e modificaremos o código da parte de listeners de evento do plugin `CameraControl` para que ele ofereça suporte a dispositivos de entrada como telas sensíveis ao toque, entre outros.

![PointerEvent](https://gw.alipayobjects.com/mdn/rms_6ae20b/afts/img/A*FtyaTL5gzv4AAAAAAAAAAAAAARQnAQ)

Agora, vamos ao próximo assunto: como tornar o movimento da câmera mais natural.

## Animação de câmera {#camera-animation}

O Mapbox oferece o método [flyTo - Mapbox], que consegue se mover suavemente entre locais diferentes. Vamos nos basear em [WebGL Insights - 23.Designing Cameras for WebGL Applications] para implementar animações de câmera, permitindo transições suaves entre quaisquer estados da câmera.

![Landmark](https://xiaoiver.github.io/assets/img/webgl/landmark.png)

O uso esperado da API relacionada é o seguinte:

1. Criar um `Landmark`, que pode representar o estado atual da câmera e também definir parâmetros como posição, ângulo de rotação e escala.
2. Fazer a câmera transicionar do estado atual para um `Landmark` especificado, incluindo um efeito de transição suave durante o processo.

```ts
const landmark = camera.createLandmark({ zoom: 2 });
camera.gotoLandmark(landmark, { duration: 300 });
```

### Criar um Landmark {#create-landmark}

O `Landmark` precisa armazenar os estados da câmera:

```ts
export interface Landmark {
    zoom: number;
    x: number;
    y: number;
    rotation: number;
}
```

Criar um `Landmark` consiste, essencialmente, apenas em armazenar os parâmetros da câmera, que serão sobrescritos se o usuário os informar:

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

### Efeitos de animação {#animation-effects}

Usamos [bezier-easing] para implementar [Cubic Bézier easing functions]:

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

Agora, vamos projetar a API de mudança para um `Landmark`. Com base na [Web Animations API], oferecemos suporte aos seguintes parâmetros:

-   `easing` Oferece suporte a `ease` e `linear`, como no CSS
-   `duration` Passar `0` pula a animação.
-   `onframe` Callback a cada quadro durante a animação
-   `onfinish` Callback quando a animação termina

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

Se `duration` for passado como `0`, não há efeito de animação; os parâmetros da câmera contidos no `Landmark` são usados para atualizar diretamente e disparar o callback de término:

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

Qualquer animação em andamento deve ser interrompida antes de iniciar uma nova (quando houver). Em seguida, implementamos a lógica de cada quadro durante o processo de animação. Se `duration` for ultrapassado, a animação deve terminar imediatamente:

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

Com a função de easing definida antes, obtemos o valor do tempo e então usamos `vec2.lerp` para interpolar e derivar os parâmetros atuais da câmera, que por fim são aplicados para atualizar a matriz da câmera:

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

Capture o estado inicial uma única vez quando a animação começa. Interpolar a partir do estado atualizado da câmera a cada quadro altera a curva de easing e faz o resultado depender da taxa de quadros. Uma animação só pode terminar antes da hora quando tanto a posição quanto o zoom/rotação tiverem chegado aos destinos; verificar só a posição pularia uma animação apenas de zoom:

```ts
if (
  vec2.dist(interPosition, destPosition) <= EPSILON &&
  vec2.dist(interZoomRotation, destZoomRotation) <= EPSILON
) {
    endAnimation();
    return;
}
```

Volte ao exemplo no topo da página e experimente. Clique no botão para retornar a câmera ao estado inicial.

## Leitura adicional {#extended-reading}

-   [WebGL Insights - 23.Designing Cameras for WebGL Applications]
-   [LearnWebGL - Introduction to Cameras]
-   [WebGL 3D - Cameras]

[LearnWebGL - Introduction to Cameras]: https://learnwebgl.brown37.net/07_cameras/camera_introduction.html#a-camera-definition
[How to Create a Figma-like Infinite Canvas in WebGL]: https://betterprogramming.pub/how-to-create-a-figma-like-infinite-canvas-in-webgl-8be94f65674f
[WebGL Insights - 23.Designing Cameras for WebGL Applications]: https://github.com/lnickers2004/WebGL-Insights
[WebGL 3D - Cameras]: https://webglfundamentals.org/webgl/lessons/webgl-3d-camera.html
[How to implement zoom from mouse in 2D WebGL]: https://webglfundamentals.org/webgl/lessons/webgl-qna-how-to-implement-zoom-from-mouse-in-2d-webgl.html
[gl-matrix]: https://github.com/toji/gl-matrix
[problema de alinhamento]: /pt-BR/guide/lesson-003.html#alignment
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
