---
outline: deep
description: 'Implemente transformações (translação, escala, rotação, cisalhamento) e a arquitetura de grafo de cena. Construa um modelo simples do Sistema Solar que demonstra transformações hierárquicas e sistemas de coordenadas.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: 'Lição 3 - Grafo de cena e transformação',
          },
      ]
---
# Lição 3 - Grafo de cena e transformação {#lesson-3-scene-graph-and-transform}

Na última lição, desenhamos um círculo. Nesta lição, você vai aprender o seguinte:

-   Transformações. Fazer as formas suportarem transformações de deslocamento, zoom, rotação e cisalhamento.
-   Grafo de cena.

Por fim, vamos usar os recursos acima para realizar um modelo simples do Sistema Solar.

```js eval code=false
(async () => {
    const { Canvas, Circle, Group } = Lesson3;
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
    return canvas.getDOM();
})();
```

## Transformação {#transform}

[Transform CSS] oferece estas transformações: `translate` `scale` `rotate` e `skew`.
As matrizes por trás dessas transformações podem ser encontradas em [Transformações - LearnOpenGL]. Como a nossa cena contém apenas gráficos 2D, precisamos apenas de uma matriz 3x3 e, como a última linha de `[0, 0, 1]` é fixa, na verdade só precisamos armazenar 6 elementos da matriz:

```bash
| a | c | tx|
| b | d | ty|
| 0 | 0 | 1 |
```

Adicionamos um atributo `transform` à nossa classe base gráfica usando diretamente o [@pixi/math] ou, é claro, o [gl-matrix].

```ts
import { Transform } from '@pixi/math';

export abstract class Shape {
    transform = new Transform();
}
```

Antes de adicionar mais métodos, vamos apresentar um conceito importante.

### Coordenadas locais e de mundo {#local-and-world-coordinates}

Sistemas de coordenadas podem ser usados para descrever a posição, a rotação e a escala de objetos em uma cena; o sistema de coordenadas mais conhecido é o sistema de coordenadas euclidiano. Em gráficos, também usamos o sistema de coordenadas do centro de gravidade. O espaço euclidiano pode conter até N dimensões; aqui vamos usar apenas duas dimensões.

Quando dizemos "a lua gira em torno da terra", na verdade estamos ignorando objetos que não sejam a terra. No sistema de coordenadas local da lua, ela simplesmente gira em torno de um ponto, embora, no sistema de coordenadas de mundo de todo o sistema solar, a terra ainda gire em torno do sol, e a lua acabe seguindo a trajetória complexa descrita acima.

Os conceitos de sistemas de coordenadas local e de mundo podem ser usados tanto em mundos 2D quanto 3D. A imagem abaixo, de [playcanvas], mostra o sistema de coordenadas de mundo à esquerda, e você pode ver que os eixos são sempre os mesmos. O lado direito mostra o sistema de coordenadas local do cubo, cujos eixos mudam conforme o objeto é transformado (neste caso, rotacionado); então, se nesse momento esse objeto rotacionado sofrer uma translação na direção positiva do eixo X (em vermelho), ele pode sair do chão.

![espaço de mundo (esquerda) e espaço local (direita)](https://gw.alipayobjects.com/mdn/rms_6ae20b/afts/img/A*kgaHRIYex8MAAAAAAAAAAAAAARQnAQ)

O sistema de coordenadas de mundo é compartilhado por todos os nós do grafo de cena, então ele tem uma origem fixa `(0, 0)`, e a orientação dos eixos XYZ (eixos XY na cena 2D) é fixa. Mesmo que a caixa na cena gire sobre si mesma, o sistema de coordenadas de mundo não muda para ela. Mas, para o seu próprio sistema de coordenadas local, a origem não é mais `(0, 0)`, e sim a posição do próprio objeto, e os eixos naturalmente mudam. Como o nome sugere, ele está associado ao próprio objeto.

Imagine que a caixa seja movida "10 unidades ao longo do eixo X (vermelho)", o que tem um significado completamente diferente em um sistema de coordenadas diferente. Portanto, quando queremos transformar um objeto, primeiro temos que especificar o sistema de coordenadas em que ele está.

Além disso, o sistema de coordenadas local também é chamado de **sistema de coordenadas do modelo**, o que é mais conveniente ao descrever a transformação do próprio modelo. Se queremos fazer cada soldado virar a cabeça, é obviamente mais fácil fazer isso no sistema de coordenadas local, porque a transformação "virar" é relativa à cabeça de cada modelo.
![espaço local e espaço de mundo](https://gw.alipayobjects.com/mdn/rms_6ae20b/afts/img/A*9B4FRo4UbNsAAAAAAAAAAAAAARQnAQ)

Adicionamos métodos para transformações nos sistemas de coordenadas local e de mundo à classe base gráfica, fornecidos em [@pixi/math]:

```ts
export abstract class Shape {
    get localTransform(): Matrix {
        return this.transform.localTransform;
    }
    get worldTransform(): Matrix {
        return this.transform.worldTransform;
    }
}
```

A figura a seguir, de [Fundamentos de computação gráfica, 4ª edição], mostra o sistema de coordenadas local (do objeto) sendo transformado por uma transformação de modelo para o sistema de coordenadas de mundo, depois por uma transformação de câmera para o sistema de coordenadas da câmera, depois por uma transformação de projeção para o sistema de coordenadas de recorte (espaço de recorte/NDC) e, por fim, por uma transformação de viewport para o sistema de coordenadas da tela (espaço da tela/de pixels). Vamos apresentar a câmera mais adiante; por enquanto, só precisamos nos importar com a transformação de modelo.

![coordenadas](/coordinates.png)

Em seguida, precisamos passar a matriz de transformação de modelo ao shader para transformar as posições dos vértices.

### Alinhamento {#alignment}

No Vertex Shader, a matriz de transformação de modelo é passada via Uniform e então multiplicada à esquerda do vetor de posição:

```glsl
layout(std140) uniform ShapeUniforms {
  mat3 u_ModelMatrix;
};

vec2 position = (u_ModelMatrix * vec3(a_Position + a_Size * a_FragCoord, 1)).xy;
```

Naturalmente, criamos diretamente um `Float32Array` de comprimento 9 (uma matriz de 3 \* 3):

```ts
this.#uniformBuffer = device.createBuffer({
    viewOrSize: Float32Array.BYTES_PER_ELEMENT * 9, // mat3
    usage: BufferUsage.UNIFORM,
    hint: BufferFrequencyHint.DYNAMIC,
});
```

Mas então o console relata um erro dizendo que o Uniform Buffer que criamos não é longo o bastante. O que está acontecendo?

```bash
[.WebGL-0x10800c78f00] GL_INVALID_OPERATION: It is undefined behaviour to use a uniform buffer that is too small.
```

Aqui precisamos introduzir o conceito de [Layout de memória]. O Uniform Block suporta as regras de layout `packed` `shared` `std140` `std430`. Regras de layout diferentes levam a maneiras diferentes de armazenar e ler dados no buffer. A vantagem de escolher `std140` é que não há diferenças de layout entre Programs (em comparação com `packed`) e não há diferenças entre implementações de OpenGL (em comparação com `shared`), mas a desvantagem é que você precisa lidar com o alinhamento manualmente, e a documentação no site oficial dá um aviso sobre isso, lembrando que devemos tentar evitar `vec3` para contornar o alinhamento:

> Aviso: às vezes as implementações erram o layout std140 para componentes vec3. Recomenda-se preencher manualmente suas estruturas/arrays e evitar completamente o uso de vec3.

Então, o que é alinhamento? Vamos tomar `vec3` como exemplo: ele tem `4 * 3` bytes de comprimento, mas na verdade ocupa 16. Na prática, as regras de alinhamento são muito complexas, e aqui `mat3` na verdade ocupa `4 * 12` bytes de armazenamento:

```ts
this.#uniformBuffer = device.createBuffer({
    viewOrSize: Float32Array.BYTES_PER_ELEMENT * 12, // mat3
    usage: BufferUsage.UNIFORM,
});
```

[wgsl-offset-computer] é uma ótima ferramenta online para ajudar a entender as regras de alinhamento por meio de visualização:

![struct: ShapeUniforms](/wgsl-offset-computer.png)

Precisamos adicionar padding manualmente ao gravar os dados:

```bash
| a | c | tx|
| b | d | ty|
| 0 | 0 | 1 |
| padding | padding | padding |
```

```ts
const PADDING = 0;
const { a, b, c, d, tx, ty } = this.worldTransform;
this.#uniformBuffer.setSubData(
    0,
    new Uint8Array(
        new Float32Array([
            a,
            b,
            0,
            PADDING,
            c,
            d,
            0,
            PADDING,
            tx,
            ty,
            1,
            PADDING,
        ]).buffer,
    ),
);
```

Vale observar que o mesmo [Alinhamento de buffers Uniform e Storage] está disponível em WGSL, e há o [bytemuck] no ecossistema Rust para ajudar a automatizar o alinhamento. O exemplo a seguir vem do [bevy]:

```rust
use bytemuck::{Pod, Zeroable};

#[repr(C)]
#[derive(Copy, Clone, Pod, Zeroable)]
pub struct UiMaterialVertex {
    pub position: [f32; 3],
    pub uv: [f32; 2],
    pub border_widths: [f32; 4],
}
```

Vamos adicionar APIs de transformação, como translação, rotação e zoom, aos gráficos.

### Translação {#translation}

[Translação 2D no WebGL]

```ts
export abstract class Shape {
    get position(): ObservablePoint {
        return this.transform.position;
    }
    set position(value: IPointData) {
        this.transform.position.copyFrom(value);
    }

    get x(): number {
        return this.position.x;
    }
    set x(value: number) {
        this.transform.position.x = value;
    }

    get y(): number {
        return this.position.y;
    }
    set y(value: number) {
        this.transform.position.y = value;
    }
}
```

O uso é consistente com o PIXI.js:

```js eval code=false
circle = call(() => {
    const { Circle } = Lesson3;
    return new Circle({
        cx: 100,
        cy: 100,
        r: 50,
        fill: 'red',
    });
});
```

```js eval code=false
positionX = Inputs.range([0, 100], { label: 'position.x', value: 0, step: 1 });
```

```js eval code=false
positionY = Inputs.range([0, 100], { label: 'position.y', value: 0, step: 1 });
```

```js eval
call(() => {
    circle.position.x = positionX;
    circle.position.y = positionY;
});
```

```js eval code=false
(async () => {
    const { Canvas } = Lesson3;
    const canvas = await Utils.createCanvas(Canvas, 200, 200);
    canvas.appendChild(circle);

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
    return canvas.getDOM();
})();
```

### Pivô {#pivot}

Rotação, escala e cisalhamento exigem que o centro da transformação seja especificado. No Pixi.js, nós o chamamos de `pivot`. Ele não é o mesmo que `transform-origin` no CSS. Veja: [Posicionamento no PixiJS].

<img src="https://aphgames.io/img/docs/tutorials/02-pixi/pos_single_rot_1.svg" alt="a rotação é em torno da origem/pivô, que por padrão fica no canto superior esquerdo" width="100%"/>

`pivot` também afeta o deslocamento da posição do objeto.

<img src="https://aphgames.io/img/docs/tutorials/02-pixi/pos_single_2.svg" alt="o pivô também afeta o deslocamento da posição do objeto" width="100%"/>

```ts
export abstract class Shape {
    get pivot(): ObservablePoint {
        return this.transform.pivot;
    }
    set pivot(value: IPointData) {
        this.transform.pivot.copyFrom(value);
    }
}
```

### Rotação {#rotation}

```ts
export abstract class Shape {
    get rotation(): number {
        return this.transform.rotation;
    }
    set rotation(value: number) {
        this.transform.rotation = value;
    }
}
```

```js eval code=false
circle2 = call(() => {
    const { Circle } = Lesson3;
    const circle = new Circle({
        cx: 0,
        cy: 0,
        r: 50,
        fill: 'red',
    });
    circle.position = { x: 100, y: 100 };
    return circle;
});
```

```js eval code=false
pivotX = Inputs.range([0, 100], { label: 'pivot.x', value: 0, step: 1 });
```

```js eval code=false
pivotY = Inputs.range([0, 100], { label: 'pivot.y', value: 0, step: 1 });
```

```js eval
call(() => {
    circle2.pivot.x = pivotX;
    circle2.pivot.y = pivotY;
});
```

```js eval code=false
(async () => {
    const { Canvas } = Lesson3;
    const canvas = await Utils.createCanvas(Canvas, 200, 200);
    canvas.appendChild(circle2);

    let id;
    const animate = () => {
        circle2.rotation += 0.01;
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

### Escala {#scaling}

```ts
export abstract class Shape {
    get scale(): ObservablePoint {
        return this.transform.scale;
    }
    set scale(value: IPointData) {
        this.transform.scale.copyFrom(value);
    }
}
```

```js eval code=false
circle3 = call(() => {
    const { Circle } = Lesson3;
    return new Circle({
        cx: 0,
        cy: 0,
        r: 50,
        fill: 'red',
    });
});
```

```js eval code=false
pivotX2 = Inputs.range([0, 100], { label: 'pivot.x', value: 0, step: 1 });
```

```js eval code=false
pivotY2 = Inputs.range([0, 100], { label: 'pivot.y', value: 0, step: 1 });
```

```js eval code=false
scaleX = Inputs.range([0, 5], { label: 'scale.x', value: 1, step: 0.1 });
```

```js eval code=false
scaleY = Inputs.range([0, 5], { label: 'scale.y', value: 1, step: 0.1 });
```

```js eval
call(() => {
    circle3.pivot.x = pivotX2;
    circle3.pivot.y = pivotY2;
    circle3.scale.x = scaleX;
    circle3.scale.y = scaleY;
    circle3.position.x = 100;
    circle3.position.y = 100;
});
```

```js eval code=false
(async () => {
    const { Canvas } = Lesson3;
    const canvas = await Utils.createCanvas(Canvas, 200, 200);
    canvas.appendChild(circle3);

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
    return canvas.getDOM();
})();
```

### Cisalhamento {#skew}

```ts
export abstract class Shape {
    get skew(): ObservablePoint {
        return this.transform.skew;
    }
    set skew(value: IPointData) {
        this.transform.skew.copyFrom(value);
    }
}
```

## Grafo de cena {#scenegraph}

Um [Grafo de cena] é uma estrutura de dados para organizar e gerenciar cenas virtuais 2D/3D e é um grafo acíclico dirigido. O grafo de cena oferece duas grandes capacidades:

1. descrever relações pai-filho
2. automatizar alguns cálculos complexos em cascata com base nas relações pai-filho.

O painel esquerdo no Figma mostra o grafo de cena:

![grafo de cena no Figma](/scenegraph-figma.png)

Imagine que precisamos construir um cenário simples de sistema solar com as seguintes relações hierárquicas:

```bash
solarSystem
   |    |
   |   sun
   |
 earthOrbit
   |    |
   |  earth
   |
 moonOrbit
      |
     moon
```

Use esta descrição de API, em que `Group` simplesmente herda a classe base gráfica e não precisa sobrescrever os métodos de renderização:

```ts
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
```

### Relações pai-filho {#parent-child-relationships}

Adicione as propriedades `parent` e `children` aos gráficos:

```ts
export abstract class Shape {
    parent: Shape;
    readonly children: Shape[] = [];
}
```

Em seguida, adicionamos o método de nó `append/removeChild`. Se o nó filho já tiver tido um nó pai adicionado antes, ele é removido primeiro. A definição de `_parentID` aqui está relacionada à implementação do [@pixi/math], tratada na última subseção:

```ts{7}
export abstract class Shape {
  appendChild(child: Shape) {
    if (child.parent) {
      child.parent.removeChild(child);
    }
    child.parent = this;
    child.transform._parentID = -1;
    this.children.push(child);

    return child;
  }
}
```

### Percorrer o grafo de cena {#traverse-scene-graph}

Com a hierarquia definida, podemos percorrer todo o grafo de cena usando recursão, adicionando um método utilitário aqui:

```ts
export function traverse(shape: Shape, callback: (shape: Shape) => void) {
    callback(shape);
    shape.children.forEach((child) => {
        traverse(child, callback);
    });
}
```

Durante a renderização da tela, use os métodos utilitários acima para renderizar cada gráfico por vez:

```ts{6}
export class Canvas {
  render() {
    const { hooks } = this.#pluginContext;
    hooks.beginFrame.call();
    this.#shapes.forEach((shape) => {
      traverse(shape, (s) => {
        hooks.render.call(s);
      });
    });
    hooks.endFrame.call();
  }
}
```

### Atualizar a transformação {#update-transform}

No grafo de cena, a matriz de transformação de um nó filho no sistema de coordenadas de mundo é calculada da seguinte forma:

```bash
child's WorldTransform = parent's WorldTransform
    * child's LocalTransform
```

Concluímos a atualização da matriz de transformação antes de renderizar cada quadro:

```ts{2}
hooks.render.tap((shape) => {
  shape.transform.updateTransform(
    shape.parent ? shape.parent.transform : IDENTITY_TRANSFORM,
  );
  shape.render(this.#device, this.#renderPass, this.#uniformBuffer);
});
```

Você pode se preocupar: se o gráfico não for transformado, ele ainda precisa ser atualizado a cada quadro? Afinal, o grafo de cena inteiro precisa executar operações em cada gráfico, o que é muita sobrecarga. Apresentamos esse padrão de projeto em [Lição 2 - Flag suja](/pt-BR/guide/lesson-002.html#dirty-flag), mas agora vamos analisar a implementação do [@pixi/math].

Cada vez que uma transformação ocorre, a transformação de translação, por exemplo, apenas incrementa o número de versão `_localID`:

```ts
this.position = new ObservablePoint(this.onChange, this, 0, 0);

protected onChange(): void {
    this._localID++;
}
```

Ao atualizar a matriz de transformação local, o número de versão é usado para determinar se a transformação não ocorreu desde a última vez; caso contrário, as operações reais de matriz são executadas. Quando termina, atualize o número de versão e force a atualização da matriz de transformação de mundo, o que é feito redefinindo `_parentID`:

```ts{3}
updateTransform(parentTransform: Transform): void {
    const lt = this.localTransform;
    if (this._localID !== this._currentLocalID) {
        // Perform actual matrix operations
        lt.a = this._cx * this.scale.x;
        // ...
        this._currentLocalID = this._localID;
        this._parentID = -1;
    }
    if (this._parentID !== parentTransform._worldID) {
        this._parentID = parentTransform._worldID;
        this._worldID++;
    }
}
```

Lembra do novo método `appendChild` que adicionamos antes? Como o pai mudou, precisamos redefinir `_parentID` para que a matriz no sistema de coordenadas de mundo seja recalculada na próxima atualização:

```ts{2}
appendChild(child: Shape) {
    child.transform._parentID = -1;
}
```

Esse padrão também é usado no PIXI.js para operações de alta sobrecarga, como calcular a caixa envolvente.

## Leitura adicional {#extended-reading}

-   [Grafo de cena no Pixi.js]
-   [Grafo de cena - LearnOpenGL]
-   [Por dentro do PixiJS: objetos de exibição e sua hierarquia]
-   [Entendendo transformações matriciais 3D]

[Transform CSS]: https://developer.mozilla.org/en-US/docs/Web/CSS/transform
[Transformações - LearnOpenGL]: https://learnopengl.com/Getting-started/Transformations
[@pixi/math]: https://www.npmjs.com/package/@pixi/math
[gl-matrix]: https://github.com/toji/gl-matrix
[Fundamentos de computação gráfica, 4ª edição]: https://www.amazon.com/Fundamentals-Computer-Graphics-Steve-Marschner/dp/1482229390
[Grafo de cena]: https://zh.wikipedia.org/zh-cn/%E5%9C%BA%E6%99%AF%E5%9B%BE
[Grafo de cena - LearnOpenGL]: https://learnopengl.com/Guest-Articles/2021/Scene/Scene-Graph
[playcanvas]: https://developer.playcanvas.com/en/tutorials/manipulating-entities/
[Translação 2D no WebGL]: https://webglfundamentals.org/webgl/lessons/webgl-2d-translation.html
[Layout de memória]: https://www.khronos.org/opengl/wiki/Interface_Block_(GLSL)#Memory_layout
[Alinhamento de buffers Uniform e Storage]: https://sotrh.github.io/learn-wgpu/showcase/alignment/#alignment-of-uniform-and-storage-buffers
[bytemuck]: https://docs.rs/bytemuck/
[bevy]: https://bevyengine.org/
[Por dentro do PixiJS: objetos de exibição e sua hierarquia]: https://medium.com/swlh/inside-pixijs-display-objects-and-their-hierarchy-2deef1c01b6e
[Entendendo transformações matriciais 3D]: https://medium.com/swlh/understanding-3d-matrix-transforms-with-pixijs-c76da3f8bd8
[Posicionamento no PixiJS]: https://aphgames.io/docs/learning/tutorials/pixi_positions
[wgsl-offset-computer]: https://webgpufundamentals.org/webgpu/lessons/resources/wgsl-offset-computer.html#x=5d00000100b900000000000000003d888b0237284d3025f2381bcb288a92bedb79fca10c66815376fc2bf5fb30136b32803636d8a0cd1920b3c155315e5767b430151489cee2b64fbf433be601ac37b5c8a93419775b8ee51571e13b44c1d867e61e8a28bd0e628b80f99570f9d3feafad585f4517807268a20c783cb178401ab49f2e3742419fe1157f8f92396145394a631090a0189fffdc5e4000
[Grafo de cena no Pixi.js]: https://pixijs.com/8.x/guides/basics/scene-graph
