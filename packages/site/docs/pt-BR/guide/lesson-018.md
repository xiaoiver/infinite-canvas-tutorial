---
outline: deep
description: 'Refatore a arquitetura com Entity-Component-System (ECS) usando Becsy. Substitua os mixins do TypeScript por uma abordagem baseada em composição e implemente plugins, componentes e sistemas para melhorar a modularidade.'
head:
    - [
          'meta',
          { property: 'og:title', content: 'Lição 18 - Refatorar com ECS' },
      ]
---
<script setup>
import Spectrum from '../../components/Spectrum.vue'
</script>

# Lição 18 - Refatorar com ECS {#lesson-18-refactor-with-ecs}

Decidi refatorar neste ponto. A partir desta lição, vamos implementar os dois pacotes npm a seguir:

-   [@infinite-canvas-tutorial/ecs] Implementa ECS com [Becsy] e inclui Plugins, Components e Systems embutidos.
-   [@infinite-canvas-tutorial/webcomponents] Implementa interfaces com base no [Spectrum], substituindo o Shoelace usado na [Lição 7]. Não se preocupe: os dois se baseiam na implementação do Lit.

<Spectrum />

No momento, usamos [TypeScript Mixins] para implementar componentes, mas essa abordagem baseada em herança tem problemas evidentes: classes de componentes em camadas são difíceis de manter:

```ts
// Current approach
export const Shape = Shapable(Renderable(Sortable(Transformable(EventTarget))));
const shape = new Shape();

// ECS approach
const shape = world.spawn(Renderable, Sortable, Transformable);
```

O ECS lida bem com composição e permite ampliar, com flexibilidade, as capacidades da entidade conforme a necessidade, como destaca [Entity-Component-System in A-Frame].

> Os benefícios do ECS incluem:
>
> -   Maior flexibilidade ao definir objetos, misturando e combinando partes reutilizáveis.
> -   Elimina os problemas de longas cadeias de herança com funcionalidade complexa entrelaçada.

O A-Frame é um framework conhecido de Three.js, com um uso declarativo de ECS que impressiona.
Em motores de jogos, o ECS é usado de forma mais ampla, como em [ECS for Unity] e [Bevy ECS], que são a principal referência da nossa implementação.

## O que é a arquitetura ECS {#what-is-ecs}

[ecs-faq] reúne perguntas comuns, recursos e implementações em várias linguagens, e vale a pena consultar. Aqui citamos a introdução de [Bevy ECS]:

> Toda a lógica do aplicativo no Bevy usa o paradigma Entity Component System, frequentemente abreviado como ECS. ECS é um padrão de software que consiste em dividir o programa em **Entities**, **Components** e **Systems**. Entities são "coisas" únicas às quais se atribuem grupos de Components, que então são processados por Systems.

O diagrama a seguir, de [ECSY Architecture], mostra visualmente a relação entre essas partes:

![Arquitetura do ECSY](https://ecsyjs.github.io/ecsy/docs/manual/images/ECSY%20Architecture.svg)

A relação entre Entity e Component pode ser entendida a partir da visão de uma tabela de banco de dados relacional, em que o primeiro corresponde às linhas de dados e o segundo aos campos:

![Layout simples de ECS](https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/ECS_Simple_Layout.svg/440px-ECS_Simple_Layout.svg.png)

Do ponto de vista de quem chama, é mais fácil entender o princípio de [Composition over inheritance]. Ao mesmo tempo, dá para ver que Entity e Component não contêm lógica de processamento específica, apenas dados associados.

```rs
commands.spawn(Position(10, 20), Color(255, 0, 0)); // Entity #1
commands.spawn(Position(30, 40), Color(0, 255, 0)); // Entity #2
```

Cada System seleciona, por meio de uma Query, uma lista de Entities com os Components específicos de que se importa, comparável a usar SQL para consultar uma tabela de dados:

```rs
// @see https://bevyengine.org/learn/quick-start/getting-started/ecs/#your-first-query
fn print_position_system(query: Query<&Position>) {
    for position in &query {
        println!("position: {} {}", position.x, position.y);
    }
}
```

De uma perspectiva global, a aplicação inteira é dividida em vários Systems:

![Um exemplo do ECSY](https://ecsyjs.github.io/ecsy/docs/manual/images/dragons.svg)

Em aplicações reais, e não em demos simples, surgem as questões a seguir, que vamos detalhar mais adiante e que formam a base da nossa escolha de implementação de ECS:

1. Como construir uma Query complexa com uma sintaxe intuitiva e amigável?
2. Como controlar a ordem de execução de vários Systems?
3. Como os Systems se comunicam entre si?

Vamos primeiro olhar alguns complementos do ECS.

### Plugins {#plugins}

No Capítulo 2 [Plugin System], usamos essa abordagem para demonstrar alta coesão e melhorar a extensibilidade. [Bevy Plugins] também usa uma abordagem parecida para organizar a funcionalidade embutida, e cada Plugin contém Components e Systems. Os usuários também podem desenvolver os próprios plugins dessa forma:

> Um dos princípios centrais do Bevy é a modularidade. Todos os recursos do motor Bevy são implementados como plugins: coleções de código que modificam um App.

Na prática, é fácil estender:

```rs
fn main() {
    App::new()
        .add_plugins(DefaultPlugins) // Default plugin set provided by the official team
        .add_systems(Startup, add_people)
        .add_systems(Update, (hello_world, (update_people, greet_people).chain()))
        .run();
}
```

No nosso projeto, os plugins embutidos ficam em `/plugins` e são expostos como uma coleção de plugins por meio de `DefaultPlugins`, que pode ser usada no momento da inicialização. É claro que você também pode personalizar plugins para estendê-los:

```ts
import { App, DefaultPlugins } from '@infinite-canvas-tutorial/ecs';

new App().addPlugins(...DefaultPlugins, MyPlugin).run();
```

### Recursos {#resources}

Já apresentamos como as combinações de Entity e Component formam uma estrutura parecida com uma tabela de dados, mas as aplicações inevitavelmente usam alguns objetos globalmente únicos. Veja: [Bevy Resources]. Na implementação seguinte, vamos usar o conceito de `singleton`.

## Implementação de ECS no frontend {#ecs-implementation-in-frontend}

Há várias implementações de ECS prontas para uso no frontend. Embora eu goste muito dos diagramas da documentação de [ECSY Architecture] (que referenciei acima), percebi que o ECSY não serve para o projeto atual. Depois de comparar [koota] e [Becsy], decidi usar o segundo no projeto. A seguir, gostaria de apresentar alguns recursos que me interessam.

| Recurso                    | Becsy | koota | ECSY | bitECS |
| -------------------------- | ----- | ----- | ---- | ------ |
| Modificadores de Query     | ✅    | ✅    | ❌   | ❌     |
| Query reativa              | ✅    | ✅    | ✅   | ✅     |
| Ordem de execução dos Systems | ✅    | ❌    | ✅   | ✅     |
| Comunicação entre Systems  | ✅    | ❌    | ❌   | ❌     |

### Modificadores de Query {#query-modifiers}

A construção simples de Query tem suporte tanto no ECSY quanto no [bitECS]:

```ts
// https://ecsyjs.github.io/ecsy/docs/#/manual/Architecture?id=queries
SystemName.queries = {
    boxes: { components: [Box] },
    spheres: { components: [Sphere] },
};

// https://github.com/NateTheGreatt/bitECS/blob/master/docs/API.md#defineQuery
const movementQuery = defineQuery([Position, Velocity]);
```

Então, o que é uma Query complexa? Em resumo, ela permite combinar várias condições de consulta por meio de modificadores como `Not`, `Or` e `And`. Por exemplo, em [koota] e [Becsy]:

```ts
// https://github.com/pmndrs/koota?tab=readme-ov-file#query-modifiers
const staticEntities = world.query(Position, Not(Velocity));

// https://lastolivegames.github.io/becsy/guide/architecture/queries#basic-query-syntax
private activeEnemies = this.query(
    q => q.current.with(Enemy).and.withAny(stateEnum).but.without(Dead));
```

Outro recurso importante é a Query reativa, que se atualiza automaticamente quando os Components de uma Entity são adicionados, modificados ou removidos.

```ts
// koota
const Added = createAdded();
const newPositions = world.query(Added(Position));

// https://lastolivegames.github.io/becsy/guide/architecture/queries#reactive-queries
private boxes = this.query(q => q.added.and.removed.with(Box, Transform));
```

### Ordem de execução dos Systems {#system-execution-order}

No caso simples, o agendador do [Becsy] calcula a ordem final de execução com base na relação de leitura e escrita de cada System com o Component. Porém, se os dois Systems precisarem escrever no mesmo tipo de Component, então é preciso especificar explicitamente a ordem em que devem ser executados. Além das restrições `before/after`, também dá para usar algumas restrições mais intuitivas.

Por exemplo, queremos que o System `ComputeCamera` rode depois de todos os Systems que escrevem em `Camera`:

```ts
// CameraPlugin
system((s) => s.afterWritersOf(Camera))(ComputeCamera);
```

Por fim, no modo de desenvolvimento, o [Becsy] imprime no console a ordem atual de execução dos systems e informa um erro se existir um ciclo.

### Comunicação entre Systems {#system-communication}

O ideal é que cada System precise se preocupar apenas com as próprias leituras e escritas em Components, mas [Attaching systems] nos dá a capacidade de referenciar outros Systems de forma mais direta:

```ts
export class ZoomLevel extends System {
    private readonly cameraControl = this.attach(CameraControl);
}
```

Vamos olhar um exemplo da conveniência do padrão de projeto ECS.

## Hierarquia {#hierarchy}

Na [Lição 3] apresentamos estruturas de árvore como grafos de cena, em que as estruturas pai-filho são mantidas na forma de referências, que são a base de propriedades como transformações calculadas, visibilidade em cascata e assim por diante:

```ts
export abstract class Shape {
    parent: Shape;
    readonly children: Shape[] = [];
}
```

Já na arquitetura ECS, o armazenamento é linear, quer a camada inferior guarde as entidades na forma de AoS ou de SoA. Como representar essa estrutura hierárquica em uma estrutura de dados plana?

![Comparação dos layouts de memória AoS (esquerda) e SoA (direita)](https://developer-blogs.nvidia.com/wp-content/uploads/2021/08/MLFrameworksIneroperability_pic2.png)

### Definir componente {#define-component}

[Hierarchical relationships in an Entity Component System] apresenta várias abordagens:

1. Entidades hierárquicas, também conhecidas como "grafo de cena com componentes". Guarda as relações hierárquicas nas entidades e percorre de cima para baixo, como de costume.
2. Componentes hierárquicos. Guarda as relações hierárquicas nos componentes.

Escolhemos a segunda abordagem e a implementamos com a capacidade [Referencing entities] do Becsy:

```ts
import { Entity, field } from '@lastolivegames/becsy';

export class Parent {
    @field.backrefs(Children, 'parent') declare children: Entity[];
}
export class Children {
    @field.ref declare parent: Entity;
}
```

Ao adicionar um nó filho, basta associar a entidade Parent no lado do Child, e a associação passa a valer do outro lado:

```ts
// addChild(parent, child)
if (!parent.has(Parent)) {
    parent.add(Parent);
}
child.add(Children, {
    parent,
});

// getChildren()
parent.read(Parent).children; // [child]
```

O Bevy usa as novas [ECS Relationships] desde a versão 0.16:

```rs
commands.spawn(ChildOf(some_parent));
commands.entity(some_entity).insert(ChildOf(new_parent));
```

Na nossa implementação, seguimos [Bevy Hierarchy] e encapsulamos EntityCommand sobre Entity para construir a relação pai-filho acima de um jeito mais amigável para o usuário. O `AddChild` contém a implementação acima:

```ts
export class EntityCommands {
    appendChild(child: EntityCommands) {
        this.commands.add(new AddChild(this.id(), child.id()));
        return this;
    }
}

parent.appendChild(child);
```

Por fim, concluímos o registro dos dois Components no plugin:

```ts
import { component } from '@lastolivegames/becsy';

export const HierarchyPlugin: Plugin = () => {
    component(Parent);
    component(Children);
};
```

### Calcular a transformação de mundo {#calculate-world-transform}

A sintaxe de Query do System é bem autoexplicativa. Por exemplo, aqui queremos selecionar todas as entidades que contêm `Transform` e `Parent`, e calcular e atualizar o `GlobalTransform` (dos nós filhos) quando eles são adicionados pela primeira vez e quando mudam.

```ts
import { System } from '@lastolivegames/becsy';

export class PropagateTransforms extends System {
    queries = this.query(
        (q) =>
            q
                .with(Transform, Parent)
                .addedOrChanged.trackWrites.using(GlobalTransform).write,
    );
}
```

## Responder a eventos {#response-to-an-event}

Se um System é chamado a cada quadro, como respondemos a eventos assíncronos?

### Eventos do Bevy {#bevy-events}

Vamos olhar um exemplo de resposta a eventos de redimensionamento de janela no Bevy: [window-resizing], usando um `EventReader` para ler os dados carregados pelo evento `WindowResized`:

```rs
fn on_resize_system(
    mut text: Single<&mut Text, With<ResolutionText>>,
    mut resize_reader: EventReader<WindowResized>,
) {
    for e in resize_reader.read() {
        // When resolution is being changed
    }
}
```

O evento `WindowResized` é escrito por um `EventWriter`:

```rs
// https://github.com/bevyengine/bevy/blob/main/crates/bevy_winit/src/state.rs#L945-L949
// window_resized: &mut EventWriter<WindowResized>,
window_resized.write(WindowResized {
    window: window_entity,
    width: window.width(),
    height: window.height(),
});
```

Dá para ver que o mecanismo de eventos facilita a comunicação entre systems. Veja os detalhes em [Bevy Events].

### Corrotinas do Becsy {#becsy-coroutines}

Escute eventos pela API DOM no System EventWriter:

```ts
$el.addEventListener('pointerup', onPointerUp, true);
const onPointerUp = (e: PointerEvent) => {
    this.setInputTrigger(input, 'pointerUpTrigger');
};
```

Quando um evento é disparado, a flag correspondente é escrita no componente Input. Esse componente também registra o estado de disparo de outros eventos, o estado das teclas <kbd>Ctrl</kbd> e <kbd>Shift</kbd> e as coordenadas do evento. Esses estados serão usados nos comportamentos de interação seguintes, como clicar para selecionar formas, arrastar para selecionar formas e assim por diante:

```ts
export class Input {
    @field.boolean declare pointerUpTrigger: boolean;
}
```

Então, como garantir que o estado seja escrito apenas uma vez em um quadro? O Becsy oferece [coroutines] para tratar lógica que atravessa vários quadros, inclusive a capacidade de esperar um certo número de quadros ou segundos. Aqui usamos o uso mais básico:

```ts
@co private *setInputTrigger(entity: Entity, triggerKey: string): Generator {
    const input = entity.write(Input);

    if (!(triggerKey in input)) return;
    Object.assign(input, { [triggerKey]: true });

    yield;

    {
      const input = entity.hold().write(Input);
      Object.assign(input, { [triggerKey]: false });
    }

    yield;
}
```

Por fim, em systems como CameraControl, que precisam tratar eventos, dá para processar os eventos correspondentes no quadro atual por meio de flags:

```ts
execute() {
    const input = canvas.write(Input);
    if (input.pointerDownTrigger) {}
    if (input.pointerUpTrigger) {}
}
```

## Leitura adicional {#extended-reading}

-   [babylon.js coroutines]

[Bevy ECS]: https://bevyengine.org/learn/quick-start/getting-started/ecs/
[Bevy Plugins]: https://bevyengine.org/learn/quick-start/getting-started/plugins/
[Bevy Resources]: https://bevyengine.org/learn/quick-start/getting-started/resources/
[Becsy]: https://lastolivegames.github.io/becsy/
[koota]: https://github.com/pmndrs/koota
[coroutines]: https://lastolivegames.github.io/becsy/guide/architecture/systems#coroutines
[babylon.js coroutines]: https://doc.babylonjs.com/features/featuresDeepDive/events/coroutines/
[window-resizing]: https://bevyengine.org/examples/window/window-resizing/
[Bevy Events]: https://bevy-cheatbook.github.io/programming/events.html
[Entity-Component-System in A-Frame]: https://aframe.io/docs/1.7.0/introduction/entity-component-system.html
[TypeScript Mixins]: https://www.typescriptlang.org/docs/handbook/mixins.html
[ECS for Unity]: https://unity.com/ecs
[Composition over inheritance]: https://en.wikipedia.org/wiki/Composition_over_inheritance
[ecs-faq]: https://github.com/SanderMertens/ecs-faq
[ECSY Architecture]: https://ecsyjs.github.io/ecsy/docs/#/manual/Architecture?id=overview
[Plugin System]: /pt-BR/guide/lesson-001#plugin-based-architecture
[bitECS]: https://github.com/NateTheGreatt/bitECS
[Hierarchical relationships in an Entity Component System]: https://gamedev.stackexchange.com/questions/206715/hierarchical-relationships-in-an-entity-component-system
[Referencing entities]: https://lastolivegames.github.io/becsy/guide/architecture/components#referencing-entities
[Lição 3]: /pt-BR/guide/lesson-003#scene-graph
[@infinite-canvas-tutorial/ecs]: https://www.npmjs.com/package/@infinite-canvas-tutorial/ecs
[@infinite-canvas-tutorial/webcomponents]: https://www.npmjs.com/package/@infinite-canvas-tutorial/webcomponents
[Spectrum]: https://opensource.adobe.com/spectrum-web-components
[Attaching systems]: https://lastolivegames.github.io/becsy/guide/architecture/systems#attaching-systems
[Lição 7]: /pt-BR/guide/lesson-007
[Bevy Hierarchy]: https://bevy-cheatbook.github.io/fundamentals/hierarchy.html
[ECS Relationships]: https://bevyengine.org/news/bevy-0-16/#ecs-relationships
