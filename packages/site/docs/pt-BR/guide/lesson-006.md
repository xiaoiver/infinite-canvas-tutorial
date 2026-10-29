---
outline: deep
description: 'Implemente um sistema de eventos compatível com o DOM, com picking de formas, funcionalidade de arrastar e soltar e suporte a gestos. Aprenda a tratar eventos de pointer, mouse e toque em aplicativos interativos de tela.'
head:
    - ['meta', { property: 'og:title', content: 'Lição 6 - Sistema de eventos' }]
---
# Lição 6 - Sistema de eventos {#lesson-6-event-system}

Nesta lição, você vai aprender o seguinte:

-   Implementar um sistema de eventos compatível com a DOM Event API
-   Como fazer o picking de um círculo
-   Implementar um plugin de arrastar e soltar com base no nosso sistema de eventos
-   Suporte a gestos de zoom por pinça

```js eval code=false
$button = call(() => {
    const $button = document.createElement('button');
    $button.textContent = 'FlyTo origin';
    return $button;
});
```

```js eval code=false inspector=false
canvas = call(() => {
    const { Canvas } = Lesson6;
    return Utils.createCanvas(Canvas, 400, 400);
});
```

```js eval code=false
(async () => {
    const { Canvas, Circle, Group } = Lesson6;

    const solarSystem = new Group();
    const earthOrbit = new Group();
    const moonOrbit = new Group();

    const sun = new Circle({
        cx: 0,
        cy: 0,
        r: 100,
        fill: 'red',
        cursor: 'pointer',
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

    sun.addEventListener('pointerenter', () => {
        sun.fill = 'green';
    });
    sun.addEventListener('pointerleave', () => {
        sun.fill = 'red';
    });

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

No momento, as interações que oferecemos estão no nível da tela. Porém, com certeza vamos precisar oferecer recursos de edição para formas individuais no futuro. Por exemplo, ao usar o mouse para selecionar formas, como sabemos qual forma foi selecionada depois de detectar um evento de clique na tela? Queremos mudar a cor de um círculo vermelho quando o mouse entra nele ou sai dele, como demonstra o código a seguir:

```ts
sun.addEventListener('pointerenter', () => {
    sun.fill = 'green';
});
sun.addEventListener('pointerleave', () => {
    sun.fill = 'red';
});
```

Isso exige a implementação de um sistema de eventos completo.

## Projetar um sistema de eventos {#design-a-event-system}

Ao projetar o sistema de eventos, queremos seguir os seguintes princípios:

-   Manter a maior consistência possível com a DOM Event API, não só para reduzir a curva de aprendizado, mas também para se integrar ao ecossistema existente (como bibliotecas de gestos).
-   Oferecer apenas eventos padrão. Eventos avançados, como arrastar e soltar e gestos, devem ser definidos por meio de extensões.

A implementação que apresentamos abaixo se baseia inteiramente nos [PIXI.js Events Design Documents], que o PIXI.js v8 ainda usa. Se você quiser se aprofundar nos detalhes, vale a pena ler o código-fonte.

### PointerEvent {#pointerevent}

O suporte dos navegadores a eventos interativos evoluiu pelos seguintes estágios; para mais detalhes, veja: [The brief history of PointerEvent]

-   No início, havia suporte a eventos de mouse.
-   Com a popularização dos dispositivos móveis, surgiram os eventos de toque, que também disparavam eventos de mouse.
-   Depois, novos dispositivos de entrada foram introduzidos, como canetas, levando a uma variedade de estruturas de evento, o que tornava o tratamento bem trabalhoso. Por exemplo, veja [hammer.js compatibility handling for various events].
-   Um novo padrão, [PointerEvent], foi proposto, com o objetivo de cobrir todos os dispositivos de entrada mencionados acima.

![eventos de mouse, pointer e toque](/mouse-pointer-touch-events.png)

Como resultado, o [PointerEvent] de nível 2 agora tem suporte em todos os navegadores mais usados. O Hammer.js oferece suporte a ele desde 2016: [hammer.js issue].

![compatibilidade de pointer events](/can-i-use-pointer-events.png)

Então queremos normalizar Mouse / Touch / PointerEvent. O uso esperado é o seguinte:

```ts
circle.addEventListener('pointerdown', (e) => {
    e.target; // circle
    e.preventDefault();
    e.stopPropagation();
});
```

### DOMEventListener {#domeventlistener}

Primeiro, precisamos escutar uma série de eventos interativos na tela, ainda por meio da implementação de um plugin:

```ts
export class DOMEventListener implements Plugin {}
```

Para detectar se o ambiente atual oferece suporte a eventos de Pointer e Touch:

```ts
const supportsPointerEvents = !!globalThis.PointerEvent;
const supportsTouchEvents = 'ontouchstart' in globalThis;
```

Quando o ambiente atual oferece suporte a PointerEvent, podemos começar a escutar. É importante observar que nem todos os eventos podem ser escutados no `HTMLCanvasElement`. Por exemplo, o listener do evento `pointermove` precisa estar vinculado a `window` ou `document`. Caso contrário, se um evento for disparado fora do elemento DOM da tela, ele não seria detectado.

```ts
const addPointerEventListener = ($el: HTMLCanvasElement) => {
    globalThis.document.addEventListener('pointermove', onPointerMove, true);
    $el.addEventListener('pointerdown', onPointerDown, true);
    $el.addEventListener('pointerleave', onPointerOut, true);
    $el.addEventListener('pointerover', onPointerOver, true);
    globalThis.addEventListener('pointerup', onPointerUp, true);
    globalThis.addEventListener('pointercancel', onPointerCancel, true);
};
```

Se PointerEvent não tiver suporte, passamos a escutar MouseEvent, mas as funções de processamento chamadas, como `onPointerDown`, disparam internamente as funções de hook correspondentes:

```ts
const addMouseEventListener = ($el: HTMLCanvasElement) => {
    globalThis.document.addEventListener('mousemove', onPointerMove, true);
    $el.addEventListener('mousedown', onPointerDown, true);
    $el.addEventListener('mouseout', onPointerOut, true);
    $el.addEventListener('mouseover', onPointerOver, true);
    globalThis.addEventListener('mouseup', onPointerUp, true);
};
const onPointerMove = (ev: InteractivePointerEvent) => {
    hooks.pointerMove.call(ev);
};
const onPointerUp = (ev: InteractivePointerEvent) => {
    hooks.pointerUp.call(ev);
};
```

Adicionamos mais hooks à tela, para que os plugins os disparem, e os plugins seguintes de processamento do sistema de eventos respondem a eles:

```ts
export interface Hooks {
    pointerDown: SyncHook<[InteractivePointerEvent]>;
    pointerUp: SyncHook<[InteractivePointerEvent]>;
    pointerMove: SyncHook<[InteractivePointerEvent]>;
    pointerOut: SyncHook<[InteractivePointerEvent]>;
    pointerOver: SyncHook<[InteractivePointerEvent]>;
    pointerWheel: SyncHook<[InteractivePointerEvent]>;
    pointerCancel: SyncHook<[InteractivePointerEvent]>;
}
```

### Adicionar listeners à forma {#add-listeners-to-shape}

Nossa classe base de forma deve estender `EventEmitter`, que oferece os métodos `on`, `once` e `off`:

```ts
import EventEmitter from 'eventemitter3';
export abstract class Shape
    extends EventEmitter
    implements FederatedEventTarget {}
```

Tomando [addEventListener] como exemplo, precisamos implementá-lo de acordo com o padrão da API do DOM, usando os métodos existentes. Por exemplo, para listeners de evento que devem ser disparados apenas uma vez, indique isso no momento do registro usando o parâmetro [once]:

```ts{10}
export abstract class Shape {
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) {
    const once = isObject(options) && options.once;
    const listenerFn = isFunction(listener) ? listener : listener.handleEvent;

    if (once) {
      this.once(type, listenerFn, context);
    } else {
      this.on(type, listenerFn, context);
    }
  }
}
```

Por limitação de espaço, os outros métodos não serão detalhados aqui. Implementações detalhadas podem ser consultadas no código-fonte do PIXI.js:

-   `removeEventListener` para remover listeners de evento
-   `removeAllListeners` para remover todos os listeners de evento
-   `dispatchEvent` para disparar eventos personalizados

Com isso, podemos usar a API a seguir para escutar eventos e, em seguida, vamos precisar implementar o objeto de evento `e` passado ao listener:

```ts
circle.addEventListener('pointerenter', (e) => {
    circle.fill = 'green';
});
```

### Objeto de evento {#event-object}

Para cumprir por completo a DOM Event API, o PIXI.js usa `FederatedEvent` para refletir a universalidade, permitindo que ele implemente a interface [UIEvent]. Alguns métodos podem invocar diretamente eventos nativos, por exemplo `preventDefault`.

```ts
export class FederatedEvent<N extends UIEvent | PixiTouch = UIEvent | PixiTouch>
    implements UIEvent
{
    preventDefault(): void {
        if (this.nativeEvent instanceof Event && this.nativeEvent.cancelable) {
            this.nativeEvent.preventDefault();
        }

        this.defaultPrevented = true;
    }
}
```

Então, como converter um objeto de evento nativo em `FederatedEvent`? O PIXI.js primeiro os formata em `PointerEvent`. Especialmente para pontos de multitoque em `TouchEvent`, cada objeto Touch em `changedTouches` é formatado em um `PointerEvent` separado.

```ts
function normalizeToPointerEvent(
    event: InteractivePointerEvent,
): PointerEvent[] {
    if (supportsTouchEvents && event instanceof TouchEvent) {
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i] as PixiTouch;
        }
    }
}
```

Em seguida, precisamos converter `PointerEvent` em `FederatedPointerEvent`.

```ts
function bootstrapEvent(
    event: FederatedPointerEvent,
    nativeEvent: PointerEvent,
): FederatedPointerEvent {}
```

A maioria dos atributos pode ser copiada diretamente do evento nativo, mas há dois tipos de propriedades que precisam de tratamento especial:

-   A posição do evento no sistema de coordenadas da tela.
-   [target] O objeto alvo do disparo do evento, isto é, em qual objeto gráfico na tela o evento ocorre.

Vamos primeiro ver o primeiro tipo de propriedade.

### Coordenadas {#coordinates}

Quando falamos de "posição", ela é sempre relativa a um certo sistema de coordenadas. Client, Screen e Page são sistemas de coordenadas com suporte nativo do navegador. Adicionamos dois novos sistemas de coordenadas: tela e viewport.

O sistema de coordenadas da tela pode ser comparado ao sistema de coordenadas Screen do navegador, também conhecido como sistema de coordenadas do mundo. As posições que especificamos ao criar gráficos são todas relativas a esse sistema de coordenadas. Ele usa o canto superior esquerdo do elemento DOM da tela como origem, com o eixo X apontando para a direita da tela e o eixo Y apontando para a parte de baixo da tela. Também é chamado de "sistema de coordenadas do mundo" e, quando se trata de rotação, definimos o sentido de rotação como horário, ao longo da direção positiva do eixo de coordenadas.

O sistema de coordenadas do viewport pode ser comparado ao sistema de coordenadas Client do navegador. A câmera determina o ângulo a partir do qual observamos o mundo. Se a câmera não se moveu, o sistema de coordenadas do viewport e o sistema de coordenadas da tela coincidem por completo. Portanto, na área visível, as coordenadas do canto superior esquerdo do viewport são as mesmas da origem do sistema de coordenadas da tela; as duas são `[0, 0]`. Mas, se a câmera se moveu, girou ou mudou de zoom, o viewport muda de acordo e, nesse momento, o canto superior esquerdo `[0, 0]` no viewport corresponde a uma posição no sistema de coordenadas da tela diferente de `[0, 0]`.

Oferecemos métodos para a conversão entre eles e os incorporamos ao contexto do plugin:

```ts
interface PluginContext {
    api: {
        client2Viewport({ x, y }: IPointData): IPointData;
        viewport2Client({ x, y }: IPointData): IPointData;
        viewport2Canvas({ x, y }: IPointData): IPointData;
        canvas2Viewport({ x, y }: IPointData): IPointData;
    };
}
```

Antes de seguir com o processamento posterior do evento, convertemos as coordenadas do evento nativo para o sistema de coordenadas do viewport e, então, para o sistema de coordenadas do mundo. Isso é feito dentro do plugin `Event`:

```ts
export class Event implements Plugin {
    private bootstrapEvent(
        event: FederatedPointerEvent,
        nativeEvent: PointerEvent,
    ): FederatedPointerEvent {
        const { x, y } = this.getViewportXY(nativeEvent);
        event.client.x = x;
        event.client.y = y;
        const { x: canvasX, y: canvasY } = this.viewport2Canvas(event.client);
        event.screen.x = canvasX;
        event.screen.y = canvasY;
    }
}
```

Com isso, as coordenadas no objeto de evento ficam estabelecidas. Deixando de lado, por enquanto, a questão de "em qual objeto gráfico o evento ocorre", vamos primeiro ver como implementar um processo completo de propagação de eventos.

### Processo de propagação de eventos {#event-propagation-process}

Quem já conhece o fluxo de eventos do DOM certamente reconhece os seguintes conceitos:

-   A propriedade `target` do objeto de evento aponta para o elemento alvo, que no contexto da API do DOM é naturalmente um elemento DOM, enquanto na nossa tela é um objeto gráfico específico. Vamos apresentar isso na próxima seção.
-   O fluxo de eventos inclui as fases de captura e de borbulhamento, e certos métodos do objeto de evento permitem intervir nessas fases.
-   É possível adicionar um ou mais listeners para um evento específico, e eles são disparados na ordem em que foram registrados.

[Bubbling and capturing] demonstram os três estágios da propagação de eventos: durante a fase de captura, os listeners são disparados de cima para baixo, chegam ao nó alvo e então borbulham para cima. Dentro do listener, `eventPhase` pode ser usado para obter a fase atual.

![fluxo de eventos](https://javascript.info/article/bubbling-and-capturing/eventflow.svg)

O PIXI.js implementa isso em `EventBoundary`.

```ts
propagate(e: FederatedEvent, type?: string): void {
  const composedPath = e.composedPath();

  // Capturing phase
  e.eventPhase = e.CAPTURING_PHASE;
  for (let i = 0, j = composedPath.length - 1; i < j; i++) {
    e.currentTarget = composedPath[i];
    this.notifyTarget(e, type);
    if (e.propagationStopped || e.propagationImmediatelyStopped) return;
  }

  // At target phase
  e.eventPhase = e.AT_TARGET;
  e.currentTarget = e.target;
  this.notifyTarget(e, type);
  if (e.propagationStopped || e.propagationImmediatelyStopped) return;

  // Bubbling phase
  e.eventPhase = e.BUBBLING_PHASE;
  for (let i = composedPath.length - 2; i >= 0; i--) {
    e.currentTarget = composedPath[i];
    this.notifyTarget(e, type);
    if (e.propagationStopped || e.propagationImmediatelyStopped) return;
  }
}
```

## Picking {#picking}

Determinar em qual objeto gráfico um evento ocorre é feito pela função de picking. A API do DOM oferece o método [elementsFromPoint], que retorna uma lista de elementos correspondentes a um ponto especificado no sistema de coordenadas do viewport. Porém, como não estamos usando um renderizador SVG, esse método não se aplica a nós. Temos as duas opções a seguir:

-   Método geométrico. Por exemplo, determinar se um ponto está dentro de um círculo.
-   Método baseado em codificação de cor na GPU. Isso será detalhado depois.

Do ponto de vista dos critérios de picking, aspectos como a visibilidade do gráfico, o traço e o preenchimento podem ser considerados, de forma parecida com a propriedade [pointer-events] do CSS. Também adicionamos uma propriedade `pointerEvents` à classe base do gráfico:

```ts{2}
export abstract class Shape {
  pointerEvents: PointerEvents = 'auto';
}

type PointerEvents =
  | 'none'
  | 'auto'
  | 'stroke'
  | 'fill'
  | 'painted'
  | 'visible'
  | 'visiblestroke'
  | 'visiblefill'
  | 'visiblepainted'
  | 'all'
  | 'non-transparent-pixel';
```

### Plugin de picking {#picking-plugin}

Crie um plugin de picking que percorre o grafo de cena a partir do nó raiz, determinando em sequência se o ponto no sistema de coordenadas do mundo está dentro de um objeto gráfico. É importante observar que, ao haver um acerto, o item precisa ser adicionado à frente da lista, porque elementos renderizados depois aparecem em uma camada mais alta por causa da ordem de renderização. Mais adiante, é claro, vamos introduzir um atributo `zIndex` para ajustar a ordem de renderização.

```ts{10}
export class Picker implements Plugin {
  private pick(result: PickingResult, root: Group) {
    const {
      position: { x, y },
    } = result;

    const picked: Shape[] = [];
    traverse(root, (shape: Shape) => {
      if (this.hitTest(shape, x, y)) {
        picked.unshift(shape);
      }
    });

    result.picked = picked;
    return result;
  }
}
```

Durante a detecção, o primeiro passo é transformar o ponto alvo do sistema de coordenadas do mundo para o sistema de coordenadas do modelo, o que se consegue usando a inversa da matriz de transformação do modelo. Transformar para o sistema de coordenadas do modelo simplifica ao máximo os métodos geométricos de determinação seguintes:

```ts
export class Picker implements Plugin {
    private hitTest(shape: Shape, wx: number, wy: number): boolean {
        // skip testing
        if (shape.pointerEvents === 'none') {
            return false;
        }

        shape.worldTransform.applyInverse({ x: wx, y: wy }, tempLocalMapping);
        const { x, y } = tempLocalMapping;
        return shape.containsPoint(x, y);
    }
}
```

Agora vamos implementar o método `containsPoint`.

### Método geométrico {#geometric-method}

Para determinar se um ponto está dentro de um círculo, podemos usar o conhecido método de campo de distância com sinal (Signed Distance Field, SDF), mas desta vez também levamos em conta os atributos `strokeWidth` e `pointerEvents`:

```ts
class Circle {
    containsPoint(x: number, y: number) {
        const halfLineWidth = this.#strokeWidth / 2;
        const absDistance = vec2.length([this.#cx - x, this.#cy - y]);

        const [hasFill, hasStroke] = isFillOrStrokeAffected(
            this.pointerEvents,
            this.#fill,
            this.#stroke,
        );
        if (hasFill) {
            return absDistance <= this.#r;
        }
        if (hasStroke) {
            return (
                absDistance >= this.#r - halfLineWidth &&
                absDistance <= this.#r + halfLineWidth
            );
        }
        return false;
    }
}
```

Ficou bom, mas exige começar a travessia a partir do nó raiz do grafo de cena toda vez. Se houver muitos objetos gráficos na cena, o custo é significativo quando os eventos são disparados com frequência. Na próxima lição, vamos apresentar métodos de otimização relacionados.

### hitArea {#hitarea}

Às vezes, podemos querer mudar a área interativa de um gráfico, por exemplo ampliando-a um pouco para facilitar o clique quando o gráfico é pequeno, ou adicionando áreas interativas a um `Group` que não tem uma entidade concreta.

```ts
export interface FederatedEventTarget {
    hitArea?: Rectangle;
}
```

Podemos modificar o plugin `CameraControl` criado antes, primeiro adicionando uma área interativa infinitamente grande ao nó raiz. Aqui, não podemos definir diretamente a coordenada do canto superior esquerdo do retângulo como `[-Infinity, -Infinity]`, porque isso faria os cálculos de largura e altura virarem `NaN`, o que impediria as detecções seguintes:

```ts
root.hitArea = new Rectangle(
    -Number.MAX_VALUE,
    -Number.MAX_VALUE,
    Infinity,
    Infinity,
);
```

Escutamos `FederatedPointerEvent` em vez do MouseEvent nativo.

```ts
canvas.addEventListener('mousedown', (e: MouseEvent) => {}); // [!code --]
root.addEventListener('pointerdown', (e: FederatedPointerEvent) => {}); // [!code ++]
```

### hitStrokeWidth {#hit-stroke-width}

Para `Line`, `Polyline` e `Path`, um `strokeWidth` pequeno demais dificulta a interação. O Konva oferece `hitStrokeWidth` para expandir a área interativa; veja [What is hitStrokeWidth?]

Também usamos esse nome de propriedade.

### Picking com API {#picking-with-api}

A funcionalidade de picking pode ser obtida não só por eventos interativos, mas também exposta como uma API para chamadas explícitas, de forma parecida com [elementsFromPoint]. Isso será usado quando implementarmos o plugin de arrastar e soltar na próxima seção.

```ts
class Canvas {
    elementsFromPoint(x: number, y: number): Shape[] {}
    elementFromPoint(x: number, y: number): Shape {}
}
```

## Plugin de arrastar e soltar {#dragndrop-plugin}

Podemos implementar um plugin de arrastar e soltar de acordo com [Drag'n'Drop with mouse events], com PointerEvent.

```ts
export class Dragndrop implements Plugin {}
```

Para determinar as condições de início de um "drag start", são oferecidas as opções de configuração a seguir, baseadas respectivamente na distância e no tempo do arraste. Só quando essas condições forem plenamente atendidas é que uma série de eventos de arrastar e soltar, como `dragstart`, será disparada.

-   `dragstartDistanceThreshold`: este item de configuração define o limiar de detecção da distância de arraste, em pixels. Só distâncias maiores que esse valor são consideradas um início válido. O valor padrão é `0`.
-   `dragstartTimeThreshold`: este item de configuração define o limiar de detecção do tempo de arraste, em milissegundos. Só tempos maiores que esse limiar são considerados um início válido. O valor padrão é `0`.

Na implementação da HTML Drag and Drop API, dispara-se ou um evento `click` ou um evento `drag`, mas nunca os dois para a mesma ação. Esse comportamento fica evidente no [exemplo](https://plnkr.co/edit/5mdl7oTg0dPWXIip) fornecido.

Manter essa configuração na sua implementação, em que um evento `click` não dispara depois de um evento `dragend`, está de acordo com a forma como os usuários em geral entendem e interagem com elementos arrastáveis. Essa abordagem garante um comportamento consistente e previsível, que melhora a experiência do usuário ao distinguir com clareza as ações de arrastar e de clicar.

```ts
if (!e.detail.preventClick) {
    this.dispatchEvent(clickEvent, 'click');
}
```

## Modificar o plugin CameraControl {#modify-cameracontrol-plugin}

Para implementar o plugin `CameraControl` com funcionalidade de arraste, você começa tornando o nó raiz arrastável e então deixa de escutar `pointerdown` e eventos semelhantes para escutar eventos relacionados a arraste.

```ts
root.draggable = true;
root.addEventListener('dragstart', (e: FederatedPointerEvent) => {});
root.addEventListener('drag', (e: FederatedPointerEvent) => {});
root.addEventListener('dragend', (e: FederatedPointerEvent) => {});
```

No momento, nossa câmera não oferece suporte a operações de gesto. Além de aplicar zoom na tela com a roda do mouse, queremos adicionar o gesto comum de `pinch` para interações com dois dedos, de forma parecida com [pixi-viewport].

### Suporte ao gesto de pinça {#support-pinch-gesture}

Para simular eventos de gesto durante o desenvolvimento no PC, podemos usar [hammer-touchemulator], que faz parte do ecossistema do [hammer.js]. Usando o mouse junto com a tecla <kbd>Shift</kbd>, é possível emular o disparo de vários PointerEvents. Você também pode usar o simulador de iOS no Xcode, que permite testar a interação por gestos, como o zoom por pinça com dois dedos. [Interacting with your app in the iOS and iPadOS simulator]

> Pinça, zoom ou rotação com dois dedos: clique e arraste enquanto pressiona a tecla Option.

Salve a posição de cada objeto de toque ao escutar o evento `pointerdown`.

```ts
this.#touches[event.pointerId] = { last: null };
```

Ao escutar o evento `pointermove`, registre a distância entre os dois pontos de toque e compare-a com a distância anterior. Quando os dois pontos se aproximam, isso corresponde a reduzir o zoom; quando se afastam, corresponde a ampliar o zoom.

```ts
zoomByPoint(point.x, point.y, (last / dist - 1) * PINCH_FACTOR);
```

Eis o efeito no simulador de iOS.

![Pinça no simulador do iOS](/pinch-ios-simulator.gif)

### use-gesture {#use-gesture}

Também podemos usar bibliotecas de gestos prontas para uso, como [@use-gesture/vanilla]. O zoom por pinça com dois dedos corresponde ao zoom de aproximação/afastamento da câmera, e o deslize com dois dedos corresponde ao pan da câmera.

```ts
import { Gesture } from '@use-gesture/vanilla';

const gesture = new Gesture(element as HTMLCanvasElement, {
    // camera zoom in/out
    onPinch: ({ event, first, last, da, origin }) => {},
});
```

## Leitura adicional {#extended-reading}

-   [The brief history of PointerEvent]
-   [Bubbling and capturing]
-   [Drag'n'Drop with mouse events]:

[The brief history of PointerEvent]: https://javascript.info/pointer-events#the-brief-history
[hammer.js compatibility handling for various events]: https://github.com/hammerjs/hammer.js/tree/master/src/input
[hammer.js issue]: https://github.com/hammerjs/hammer.js/issues/946
[PointerEvent]: https://www.w3.org/TR/pointerevents2/
[PIXI.js Events Design Documents]: https://docs.google.com/document/d/1RyXrhrcZly2oPHPApKahE8pC7mEIDvuCPbE9VeYvmZw/edit
[addEventListener]: https://developer.mozilla.org/zh-CN/docs/Web/API/EventTarget/addEventListener
[pointer-events]: https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events
[elementsFromPoint]: https://developer.mozilla.org/en-US/docs/Web/API/Document/elementsFromPoint
[Interacting with your app in the iOS and iPadOS simulator]: https://developer.apple.com/documentation/xcode/interacting-with-your-app-in-the-ios-or-ipados-simulator#Interact-with-your-interface
[pixi-viewport]: https://github.com/davidfig/pixi-viewport
[hammer-touchemulator]: https://github.com/hammerjs/touchemulator
[hammer.js]: https://hammerjs.github.io/
[UIEvent]: https://developer.mozilla.org/en-US/docs/Web/API/UIEvent/UIEvent
[once]: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#once
[target]: https://developer.mozilla.org/en-US/docs/Web/API/Event/target
[Bubbling and capturing]: https://javascript.info/bubbling-and-capturing#capturing
[Drag'n'Drop with mouse events]: https://javascript.info/mouse-drag-and-drop
[What is hitStrokeWidth?]: https://konvajs.org/docs/events/Custom_Hit_Region.html#2-what-is-hitstrokewidth
[@use-gesture/vanilla]: https://github.com/pmndrs/use-gesture
