---
outline: deep
description: 'Otimize o desempenho de renderização ao entender draw calls, implementar culling de viewport, agrupamento de draw calls, indexação espacial para picking e técnicas de picking de cor baseadas em GPU.'
head:
    - [
          'meta',
          { property: 'og:title', content: 'Lição 8 - Otimizar o desempenho' },
      ]
---
# Lição 8 - Otimizar o desempenho {#lesson-8-optimize-performance}

Nesta lição, você vai aprender o seguinte:

-   O que é um draw call
-   Reduzir draw calls com culling
-   Reduzir draw calls ao combinar lotes
-   Usar indexação espacial para melhorar a eficiência do picking
-   Picking de cor baseado em GPU

A otimização de desempenho é uma tarefa complexa e de longo prazo, à qual eu costumo me dedicar cedo em um projeto. Antes, aprendemos a desenhar círculos usando SDF; agora vamos fazer um teste de desempenho e desenhar 1.000 círculos com um FPS de cerca de 35:

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas-lesson7');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson7;

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
            const circle = new Circle({
                cx: Math.random() * 400,
                cy: Math.random() * 200,
                r: Math.random() * 20,
                fill: 'red',
            });
            canvas.appendChild(circle);
        }
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

Estamos usando [stats.js] para medir o FPS, criando painéis posicionados no canto superior esquerdo da tela, que claramente não está fluida no momento:

```ts
const stats = new Stats();
stats.showPanel(0); // Only show FPS panel

const animate = () => {
    // Trigger updating
    if (stats) {
        stats.update();
    }
    canvas.render();
    requestAnimationFrame(animate);
};
```

Com o [Spector.js], apresentado na primeira lição, você pode ver que há uma grande quantidade de comandos de desenho. Filtrei até o comando `drawElements` e, na verdade, cada círculo corresponde a uma série de comandos WebGL (incluindo a criação de buffers etc.).

![draw calls no spector.js](/draw-calls.png)

## O que é um draw call {#draw-call}

Esses comandos de desenho se chamam draw calls, e a figura a seguir, de [Draw calls in a nutshell], explica por que o aumento no número de draw calls afeta o desempenho. Isso acontece porque todos os draw calls partem da CPU e, à medida que o número de draw calls aumenta, a CPU leva mais tempo para prepará-los. A GPU, embora renderize mais rápido, ainda precisa esperar e fica com muito tempo ocioso, então o gargalo está na CPU.

![draw calls de CPU e GPU](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*EEqn28cbO11QXkyqcoaO7g.jpeg)

Então, como reduzir o draw call? Em geral há duas linhas de raciocínio:

-   Culling de viewport.
-   Agrupamento de draw calls.

## Culling de viewport {#culling}

Gráficos fora do viewport não precisam ser renderizados. A imagem abaixo, do Unreal [How Culling Works], mostra os objetos vermelhos descartados fora do cone de visão da câmera, da perspectiva de Deus, e você pode ver que isso reduz bastante o número de draw calls desnecessários.

![frustum de visão com culling](https://d1iv7db44yhgxn.cloudfront.net/documentation/images/6f2a0e24-c0e0-4fc0-b637-29c792739474/sceneview_viewfrustumculled.png)

Em cenas 3D há muitas otimizações baseadas no algoritmo de culling pelo cone de visão da câmera, como descrito em [Efficient View Frustum Culling]. Por exemplo, a informação do grafo de cena pode ser usada para que, se um gráfico já estiver completamente dentro do cone de visão, seus nós filhos não precisem ser testados.

Os motores de renderização oferecem recursos correspondentes, por exemplo:

-   Cesium [Fast Hierarchical Culling]
-   Babylon.js [Changing Mesh Culling Strategy]
-   [pixi-cull]

Em comparação com uma cena 3D, a nossa tela 2D é bem mais simples de implementar. Então, como você determina se uma forma está no viewport? É aqui que entra o conceito de caixa delimitadora. É claro que você não precisa usar uma caixa delimitadora; em uma cena 3D, pode usar uma esfera delimitadora no lugar.

### Caixa delimitadora alinhada aos eixos {#aabb}

Uma caixa delimitadora alinhada aos eixos, ou AABB, é uma caixa delimitadora simples, muito usada em gráficos 3D, paralela aos eixos do sistema de coordenadas do mundo. Em outras palavras, seus lados estão orientados na mesma direção que os eixos de coordenadas. Uma caixa delimitadora alinhada aos eixos costuma ser retangular, e seu propósito é representar a área do espaço ocupada por um objeto ou grupo de objetos como uma caixa simplificada. Na nossa cena 2D ela é um retângulo, e só precisamos armazenar as coordenadas do canto superior esquerdo `minX/Y` e do canto inferior direito `maxX/Y`:

```ts
export class AABB {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    matrix: Matrix;

    isEmpty() {
        return this.minX > this.maxX || this.minY > this.maxY;
    }
}
```

Em seguida, adicione uma forma de obter a caixa envolvente do gráfico. Tome um círculo como exemplo e leve em conta o centro, o raio e a largura da linha. Aqui também usamos a [flag suja], para que o recálculo aconteça apenas quando os atributos relevantes mudam:

```ts
export class Circle extends Shape {
    getRenderBounds() {
        if (this.renderBoundsDirtyFlag) {
            const halfLineWidth = this.#strokeWidth / 2;
            this.renderBoundsDirtyFlag = false;
            this.renderBounds = new AABB(
                this.#cx - this.#r - halfLineWidth,
                this.#cy - this.#r - halfLineWidth,
                this.#cx + this.#r + halfLineWidth,
                this.#cy + this.#r + halfLineWidth,
            );
        }
        return this.renderBounds;
    }
}
```

### Adicionar um plugin de culling {#culling-plugin}

Adicione um plugin de culling que guarda a caixa envolvente correspondente ao viewport e, em seguida, faz a interseção com a caixa envolvente de cada gráfico. Considerando a transformação da câmera, obtemos as coordenadas dos quatro vértices do viewport no sistema de coordenadas do mundo e os enquadramos com uma caixa delimitadora. A caixa delimitadora é atualizada sempre que a câmera muda.

```ts
export class Culling implements Plugin {
    #viewport: AABB = new AABB();

    private updateViewport() {
        const {
            camera,
            api: { viewport2Canvas },
        } = this.#context;
        const { width, height } = camera;

        // tl, tr, br, bl
        const tl = viewport2Canvas({
            x: 0,
            y: 0,
        });

        this.#viewport.minX = Math.min(tl.x, tr.x, br.x, bl.x);
        this.#viewport.minY = Math.min(tl.y, tr.y, br.y, bl.y);
        this.#viewport.maxX = Math.max(tl.x, tr.x, br.x, bl.x);
        this.#viewport.maxY = Math.max(tl.y, tr.y, br.y, bl.y);
    }
}
```

Percorra o grafo de cena no início de cada quadro para determinar se a caixa envolvente do gráfico intersecta o viewport e, se não intersectar, defina `culled` como `true`, para que ele possa ser ignorado durante a renderização:

```ts
hooks.beginFrame.tap(() => {
    const { minX, minY, maxX, maxY } = this.#viewport;

    traverse(root, (shape) => {
        if (shape.renderable && shape.cullable) {
            const bounds = shape.getBounds();
            shape.culled =
                bounds.minX >= maxX ||
                bounds.minY >= maxY ||
                bounds.maxX <= minX ||
                bounds.maxY <= minY;
        }

        return shape.culled;
    });
});
```

Para ver o efeito, o número de gráficos rejeitados muda conforme você amplia e reduz o zoom, e quanto mais gráficos são rejeitados, maior o FPS:

```js eval code=false
$total = call(() => {
    return document.createElement('div');
});
```

```js eval code=false
$culled = call(() => {
    return document.createElement('div');
});
```

```js eval code=false
$icCanvas2 = call(() => {
    return document.createElement('ic-canvas-lesson8');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson8;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas2.parentElement.style.position = 'relative';
    $icCanvas2.parentElement.appendChild($stats);

    const circles = [];
    $icCanvas2.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        for (let i = 0; i < 500; i++) {
            const circle = new Circle({
                cx: Math.random() * 1000,
                cy: Math.random() * 1000,
                r: Math.random() * 20,
                fill: `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
                    Math.random() * 255,
                )},${Math.floor(Math.random() * 255)})`,
                batchable: false,
                // cullable: false,
            });
            canvas.appendChild(circle);
            circles.push(circle);
        }
    });

    $icCanvas2.addEventListener('ic-frame', (e) => {
        stats.update();
        const total = circles.length;
        const culled = circles.filter((circle) => circle.culled).length;

        $total.innerHTML = `total: ${total}`;
        $culled.innerHTML = `culled: ${culled}`;
    });
});
```

Quando o viewport contém todas as formas, não há como eliminar nenhuma delas, então precisamos usar outros meios para reduzir os draw calls.

## Renderização em lote {#batch-rendering}

Draw calls que podem ser mesclados exigem que certas condições sejam atendidas, como ter Geometry parecida, o mesmo Shader e assim por diante. [Draw call batching - Unity] apresenta duas formas de fazer isso:

-   [Static batching] Para objetos estacionários, transforme-os para o sistema de coordenadas do mundo, usando um array de vértices compartilhado. Depois de concluído, não é possível aplicar transformações a objetos individuais.
-   [Dynamic batching] Para objetos em movimento. Transforma os vértices para o sistema de coordenadas do mundo no lado da CPU, mas a própria transformação tem custo.

O Pixi.js também tem um sistema de renderização em lote embutido, usado até a versão V8, atualmente em desenvolvimento: [Inside PixiJS: Batch Rendering System].

Primeiro separamos a lógica de renderização dos gráficos, o que faz sentido; os gráficos não deveriam se preocupar com a forma como são renderizados:

```ts
class Circle {
    render(device: Device, renderPass: RenderPass, uniformBuffer: Buffer) {} // [!code --]
}
```

Antes, ao percorrer o grafo de cena, disparávamos imediatamente a lógica de renderização dos gráficos, mas agora os gráficos são adicionados à fila de renderização pendente e esperam para ser mesclados e emitidos juntos:

```ts
hooks.render.tap((shape) => {
    shape.render(); // [!code --]
    if (shape.renderable) {
        this.#batchManager.add(shape); // [!code ++]
    }
});
```

Em seguida, abstraímos a classe Drawcall e fazemos o SDF implementado anteriormente herdar dela. Ela contém o seguinte ciclo de vida:

```ts
export abstract class Drawcall {
    abstract createGeometry(): void;
    abstract createMaterial(uniformBuffer: Buffer): void;
    abstract render(renderPass: RenderPass): void;
    abstract destroy(): void;
}

export class SDF extends Drawcall {}
```

### Instanciação {#instanced}

Para grandes quantidades de formas parecidas, [WebGL2 Optimization - Instanced Drawing] pode reduzir de forma significativa o número de draw calls. Isso se chama [InstancedMesh] no Three.js. O Babylon.js também oferece [Instances], em que atributos específicos de cada instância, como matrizes de transformação, cores e outros, podem ser passados como arrays de vértices:

![nó de instâncias](https://doc.babylonjs.com/img/how_to/instances-node.png)

```glsl
#ifdef INSTANCES
  attribute vec4 world0;
  attribute vec4 world1;
  attribute vec4 world2;
  attribute vec4 world3;

  finalWorld = mat4(world0, world1, world2, world3);
#endif
```

Como consideramos apenas cenas 2D, a matriz de transformação só precisa armazenar 6 componentes:

```glsl
#ifdef USE_INSTANCES
  layout(location = 14) in vec4 a_Abcd;
  layout(location = 15) in vec2 a_Txty;

  model = mat3(a_Abcd.x, a_Abcd.y, 0, a_Abcd.z, a_Abcd.w, 0, a_Txty.x, a_Txty.y, 1);
#endif
```

Vale mencionar que as matrizes de transformação das instâncias individuais podem ser armazenadas na textura de dados, além de serem armazenadas diretamente nos dados de vértice, referenciadas por índices no array de vértices:
[Drawing Many different models in a single draw call]

Adicionamos uma flag `instanced` ao Drawcall:

```ts
export abstract class Drawcall {
    constructor(protected device: Device, protected instanced: boolean) {}
}
```

Adiciona uma diretiva de pré-compilação `define` ao cabeçalho do shader com base nessa flag:

```ts{5}
export class SDF extends Drawcall {
  createMaterial(uniformBuffer: Buffer): void {
    let defines = '';
    if (this.instanced) {
      defines += '#define USE_INSTANCES\n';
    }
  }
}
```

Assim, a matriz de transformação do modelo pode ser calculada a partir do attribute ou do uniform:

```glsl
void main() {
  mat3 model;
  #ifdef USE_INSTANCES
    model = mat3(a_Abcd.x, a_Abcd.y, 0, a_Abcd.z, a_Abcd.w, 0, a_Txty.x, a_Txty.y, 1);
  #else
    model = u_ModelMatrix;
  #endif
}
```

Neste ponto, você pode usar o [Spector.js] para ver que, mesmo com 1.000 círculos no viewport, isso pode ser feito com um único draw call:

![draw calls instanciados no spector.js](/instanced-spector.png)

Também podemos limitar o número máximo de instâncias em um Drawcall, verificando antes de cada criação e recriando se o limite for excedido:

```ts
export abstract class Drawcall {
    protected maxInstances = Infinity;
    validate() {
        return this.count() <= this.maxInstances - 1;
    }
}
```

### Ordem de renderização {#rendering-order}

Como estamos desenhando várias formas com um único draw call, precisamos prestar atenção à ordem de desenho. A posição de cada elemento no array de instâncias não equivale necessariamente à ordem final de desenho, então precisamos atribuir um valor a cada figura antes de desenhá-la de fato e, em seguida, normalizar esse valor para `[0, 1]` e passá-lo ao shader como valor de profundidade:

```ts{4}
export class Renderer implements Plugin {
  apply(context: PluginContext) {
    hooks.render.tap((shape) => {
      shape.globalRenderOrder = this.#zIndexCounter++;
    });

    hooks.beginFrame.tap(() => {
      this.#zIndexCounter = 0;
    });
  }
}
```

Em seguida, ativamos o [Depth testing], e o método de teste passa a ser: valores de profundidade maiores que o valor armazenado no Depth buffer atual (no intervalo `[0, 1]`) serão gravados (o padrão do WebGL é `gl.LESS`). No nosso cenário, os gráficos com ZIndex maior sobrescrevem os menores.

```ts
export class SDF extends Drawcall {
    createMaterial(uniformBuffer: Buffer): void {
        this.#pipeline = this.device.createRenderPipeline({
            megaStateDescriptor: {
                depthWrite: true, // [!code ++]
                depthCompare: CompareFunction.GREATER, // [!code ++]
            },
        });
    }
}
```

Por fim, um Depth RenderTarget adicional é criado quando o RenderPass é criado:

```ts
this.#renderPass = this.#device.createRenderPass({
    colorAttachment: [this.#renderTarget],
    colorResolveTo: [onscreenTexture],
    colorClearColor: [TransparentWhite],
    depthStencilAttachment: this.#depthRenderTarget, // [!code ++]
    depthClearValue: 1, // [!code ++]
});
```

Veja como funciona, desenhando 5.000 círculos com culling e otimização de lote ativados ao mesmo tempo:

```js eval code=false
$icCanvas3 = call(() => {
    return document.createElement('ic-canvas-lesson8');
});
```

```js eval code=false
$total2 = call(() => {
    return document.createElement('div');
});
```

```js eval code=false
$culled2 = call(() => {
    return document.createElement('div');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson8;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas3.parentElement.style.position = 'relative';
    $icCanvas3.parentElement.appendChild($stats);

    const circles = [];
    $icCanvas3.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        for (let i = 0; i < 5000; i++) {
            const circle = new Circle({
                cx: Math.random() * 1000,
                cy: Math.random() * 1000,
                r: Math.random() * 20,
                fill: `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
                    Math.random() * 255,
                )},${Math.floor(Math.random() * 255)})`,
                batchable: true,
                cullable: true,
            });
            canvas.appendChild(circle);
            circles.push(circle);
        }
    });

    $icCanvas3.addEventListener('ic-frame', (e) => {
        stats.update();
        const total = circles.length;
        const culled = circles.filter((circle) => circle.culled).length;

        $total2.innerHTML = `total: ${total}`;
        $culled2.innerHTML = `culled: ${culled}`;
    });
});
```

### Desativar o culling {#disable-culling}

Ativar o culling pode, na verdade, aumentar a sobrecarga de desempenho em certos cenários.

[Wikipedia Datamap]

## Otimizar o desempenho do picking {#optimizing-picking-perf}

Em seguida, vamos medir o desempenho de picking adicionando um listener de pointerenter/leave a cada Circle:

```ts
circle.addEventListener('pointerenter', () => {
    circle.fill = 'red';
});
circle.addEventListener('pointerleave', () => {
    circle.fill = fill;
});
```

20.000 pickings de Circle levaram o tempo a seguir:

![desempenho do picking](/pick-perf.png)

A AABB dos gráficos pode ser usada para culling baseado no viewport, o que permite julgamentos aproximados mais rápidos em comparação com métodos matemáticos.

### Usar indexação espacial {#using-spatial-indexing}

Um índice espacial é uma estrutura de dados usada para tratar com eficiência dados espaciais e operações de consulta, especialmente em Sistemas de Informação Geográfica (GIS), computação gráfica, desenvolvimento de jogos 3D e tecnologia de banco de dados. O principal propósito da indexação espacial é reduzir a quantidade de cálculo e o tempo necessários para buscar objetos espaciais específicos em grandes volumes de dados. Há várias estruturas de dados para indexação espacial, como Quadtree, Octree, R-tree, K-d tree e outras. Cada estrutura tem seus cenários de aplicação e vantagens específicos.

No ecossistema do PIXI.js existem bibliotecas como [pixi-spatial-hash], que criam novos índices espaciais a cada quadro. Porém, parece faltar manutenção no momento.

Usamos o [rbush], que oferece suporte a inserção em lote, em geral 2 a 3 vezes mais rápida do que inserir quadro a quadro, e também é usado no mapbox.

```ts
import RBush from 'rbush';
const rBushRoot = new RBush<RBushNodeAABB>();

export interface RBushNodeAABB {
    shape: Shape;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}
```

### Busca no RBush {#rbush-search}

O RBush oferece uma função de consulta por região, [search], à qual se passa uma caixa de consulta para retornar uma lista de gráficos atingidos:

```ts
export class Canvas {
    elementsFromBBox(
        minX: number,
        minY: number,
        maxX: number,
        maxY: number,
    ): Shape[] {
        const { rBushRoot } = this.#pluginContext;
        const rBushNodes = rBushRoot.search({ minX, minY, maxX, maxY });

        const hitTestList: Shape[] = [];
        rBushNodes.forEach(({ shape }) => {
            // Omit the process of handling the visibility and pointerEvents properties of shape.
        });
        // Sort by global render order.
        hitTestList.sort((a, b) => a.globalRenderOrder - b.globalRenderOrder);

        return hitTestList;
    }
}
```

No [plugin de picking], usamos o método de busca por região acima, mas, é claro, um ponto é passado no lugar de uma AABB:

```ts{9}
export class Picker implements Plugin {
  apply(context: PluginContext) {
    hooks.pickSync.tap((result: PickingResult) => {
      const {
        position: { x, y },
      } = result;

      const picked: Shape[] = [root];
      elementsFromBBox(x, y, x, y).forEach((shape) => {
        if (this.hitTest(shape, x, y)) {
          picked.unshift(shape);
        }
      });
      result.picked = picked;
      return result;
    });
  }
}
```

Vamos medir de novo: o tempo de picking de 20.000 Circle passa a ser 0,088 ms, uma melhora de cerca de 20 vezes!

![desempenho do picking com rbush](/pick-rbush-perf.png)

### Picking de cor baseado em GPU {#color-picking}

Na seção anterior, [Picking], mencionamos uma alternativa ao picking baseado em matemática: o picking de cor baseado em GPU. Isso se chama [Color Picking] no deck.gl.

## Leitura adicional {#extended-reading}

-   [Inside PixiJS: Batch Rendering System]
-   [Depth testing]
-   [The Depth Texture | WebGPU]
-   Three.js [BatchedMesh: Proposal]

[stats.js]: https://github.com/mrdoob/stats.js
[Spector.js]: https://spector.babylonjs.com/
[Draw calls in a nutshell]: https://toncijukic.medium.com/draw-calls-in-a-nutshell-597330a85381
[Draw call batching - Unity]: https://docs.unity3d.com/Manual/DrawCallBatching.html
[Static batching]: https://docs.unity3d.com/Manual/static-batching.html
[Dynamic batching]: https://docs.unity3d.com/Manual/dynamic-batching.html
[pixi-cull]: https://github.com/davidfig/pixi-cull
[pixi-spatial-hash]: https://github.com/ShukantPal/pixi-spatial-hash
[rbush]: https://github.com/mourner/rbush
[How Culling Works]: https://dev.epicgames.com/documentation/en-us/unreal-engine/visibility-and-occlusion-culling-in-unreal-engine#howcullingworks
[Efficient View Frustum Culling]: https://old.cescg.org/CESCG-2002/DSykoraJJelinek/
[Fast Hierarchical Culling]: https://cesium.com/blog/2015/08/04/fast-hierarchical-culling/
[Changing Mesh Culling Strategy]: https://doc.babylonjs.com/features/featuresDeepDive/scene/optimize_your_scene#changing-mesh-culling-strategy
[Inside PixiJS: Batch Rendering System]: https://medium.com/swlh/inside-pixijs-batch-rendering-system-fad1b466c420
[BatchedMesh: Proposal]: https://github.com/mrdoob/three.js/issues/22376
[InstancedMesh]: https://threejs.org/docs/?q=instanced#api/en/objects/InstancedMesh
[WebGL2 Optimization - Instanced Drawing]: https://webgl2fundamentals.org/webgl/lessons/webgl-instanced-drawing.html
[Drawing Many different models in a single draw call]: https://webglfundamentals.org/webgl/lessons/webgl-qna-drawing-many-different-models-in-a-single-draw-call.html
[Instances]: https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/instances
[flag suja]: /pt-BR/guide/lesson-002#dirty-flag
[Depth testing]: https://learnopengl.com/Advanced-OpenGL/Depth-testing
[The Depth Texture | WebGPU]: https://carmencincotti.com/2022-06-13/webgpu-the-depth-texture/
[plugin de picking]: /pt-BR/guide/lesson-006#picking-plugin
[search]: https://github.com/mourner/rbush?tab=readme-ov-file#search
[Picking]: /pt-BR/guide/lesson-006#picking
[Color Picking]: https://deck.gl/docs/developer-guide/custom-layers/picking
[Wikipedia Datamap]: /example/wikipedia-datamap
