---
outline: deep
description: 'Implemente a funcionalidade de desfazer e refazer com gerenciamento de histórico. Aprenda sobre instantâneos de estado, atualizações incrementais e o registro de entradas de histórico para dar suporte à edição colaborativa.'
head:
    - ['meta', { property: 'og:title', content: 'Lição 19 - Histórico' }]
---
<script setup>
import History from '../../components/History.vue';
</script>

# Lição 19 - Histórico {#lesson-19-history}

Nesta lição, vamos ver como implementar recursos ligados ao histórico.

<History />

Seja um editor de texto ou um editor gráfico, o histórico e a funcionalidade de desfazer e refazer são indispensáveis. Como na implementação de [JavaScript-Undo-Manager], dá para usar um undoStack para guardar cada operação e sua inversa:

```ts
function createPerson(id, name) {
    // first creation
    addPerson(id, name);

    // make undoable
    undoManager.add({
        undo: () => removePerson(id),
        redo: () => addPerson(id, name),
    });
}
```

Também dá para usar duas pilhas para gerenciar as operações de desfazer e refazer separadamente; veja: [UI Algorithms: A Tiny Undo Stack]. A última seção de [How Figma's multiplayer technology works] apresenta a abordagem de implementação do Figma:

> Por isso, no Figma, uma operação de desfazer modifica o histórico de refazer no momento do desfazer e, da mesma forma, uma operação de refazer modifica o histórico de desfazer no momento do refazer.

Seguindo [Excalidraw HistoryEntry], adicionamos uma classe History para gerenciar as operações de desfazer e refazer.

```ts
export class History {
    #undoStack: HistoryStack = [];
    #redoStack: HistoryStack = [];

    clear() {
        this.#undoStack.length = 0;
        this.#redoStack.length = 0;
    }
}
```

Cada entrada da pilha de histórico contém dois tipos de modificação do estado do sistema, que descrevemos abaixo:

```ts
type HistoryStack = HistoryEntry[];
export class HistoryEntry {
    private constructor(
        public readonly appStateChange: AppStateChange,
        public readonly elementsChange: ElementsChange,
    ) {}
}
```

## Projetar estados {#design-states}

Seguindo o Excalidraw, dividimos o estado do sistema em `AppState` e `Elements`. O primeiro inclui o estado da tela e dos componentes de interface, como o tema atual, o nível de zoom da câmera, as configurações e seleções da barra de ferramentas, e assim por diante.

```ts
export interface AppState {
    theme: Theme;
    checkboardStyle: CheckboardStyle;
    cameraZoom: number;
    penbarAll: Pen[];
    penbarSelected: Pen;
    taskbarAll: Task[];
    taskbarSelected: Task[];
    layersSelected: SerializedNode['id'][];
    propertiesOpened: SerializedNode['id'][];
}
```

Como dá para ver, preferimos uma estrutura de dados plana a uma estrutura de objeto aninhada como `{ penbar: { all: [], selected: [] } }`, para que a comparação de estado seja mais rápida e simples, sem recursão. Veja: [distinctKeysIterator].

O segundo é o array de formas na tela, que já tratamos na [Lição 10] no contexto de serializar formas. Aqui usamos um array plano em vez de uma estrutura de árvore, subimos os atributos do objeto `attributes` para o nível superior e representamos a relação pai-filho de um jeito um pouco diferente, usando `parentId` para associar o nó pai ao `id`. Porém, não dá para simplesmente percorrer a estrutura de árvore e renderizá-la: precisamos ordenar o array do grafo segundo algumas regras, que veremos mais adiante:

```ts
// before
interface SerializedNode {
    id: string;
    children: [];
    attributes: {
        fill: string;
        stroke: string;
    };
}

// after
interface SerializedNode {
    id: string;
    parentId?: string;
    fill: string;
    stroke: string;
}
```

Pensando na colaboração, vamos adicionar mais atributos, como `version`, mais adiante.

## O estado como instantâneo {#state-as-a-snapshot}

A imagem a seguir, de [State as a Snapshot], mostra como a função de renderização do React executa e então tira um instantâneo antes de atualizar a árvore do DOM:

![Instantâneo do React](/react-snapshot.png)

O nosso instantâneo contém os dois tipos de estado do sistema definidos acima. Em qualquer momento existe apenas um instantâneo do sistema e, sempre que o estado muda, dá para calcular com o instantâneo atual a modificação correspondente do estado, por exemplo "Um gráfico foi excluído" em `ElementsChange`, "Uma camada foi selecionada" em `AppStateChange`, e assim por diante.

```ts
class Snapshot {
    private constructor(
        public readonly elements: Map<string, SerializedNode>,
        public readonly appState: AppState,
    ) {}
}
```

Então, como o sistema deve atualizar o instantâneo? Do ponto de vista da estratégia, dá para escolher a sobrescrita direta ou o cálculo de uma atualização incremental. O excalidraw oferece [captureUpdate] para descrever esses dois comportamentos, adequados a cenários diferentes. Por exemplo, a sobrescrita direta serve para a inicialização da cena, já que nesse momento não há necessidade de voltar a um estado de tela em branco:

```ts
class Store {
    private _snapshot = Snapshot.empty();

    commit(
        elements: Map<string, SerializedNode> | undefined,
        appState: AppState | undefined,
    ) {
        try {
            // Capture has precedence since it also performs update
            if (this.#scheduledActions.has(CaptureUpdateAction.IMMEDIATELY)) {
                this.captureIncrement(elements, appState);
            } else if (this.#scheduledActions.has(CaptureUpdateAction.NEVER)) {
                this.updateSnapshot(elements, appState);
            }
        } finally {
            // Defensively reset all scheduled actions, potentially cleans up other runtime garbage
            this.#scheduledActions = new Set();
        }
    }
}
```

Vamos focar em como calcular o incremento e usá-lo para criar um `HistoryEntry`.

```ts
class Store {
    captureIncrement(
        elements: Map<string, SerializedNode> | undefined,
        appState: AppState | undefined,
    ) {
        const prevSnapshot = this.snapshot;
        const nextSnapshot = this.snapshot.maybeClone(elements, appState);
        const elementsChange = nextSnapshot.meta.didElementsChange
            ? ElementsChange.calculate(
                  prevSnapshot.elements,
                  nextSnapshot.elements,
                  this.api,
              )
            : ElementsChange.empty();
        // AppStateChange 同理

        // Use history.record to create HistoryEntry
    }
}
```

Vamos ver como adicionar uma entrada de histórico.

## Registrar uma entrada de histórico {#record-history-entry}

No exemplo no topo desta seção, usamos a API para inserir dois históricos de atualização da cor de preenchimento do retângulo. Você pode desfazer e refazer essas operações na barra de ferramentas superior:

```ts
api.updateNode(node, {
    fill: 'red',
});
api.record();

api.updateNode(node, {
    fill: 'blue',
});
api.record();
```

Cada chamada a `api.record` atualiza o instantâneo com o estado atual de `AppState` e `Elements`:

```ts
class API {
    record(
        captureUpdateAction: CaptureUpdateActionType = CaptureUpdateAction.IMMEDIATELY,
    ) {
        if (
            captureUpdateAction === CaptureUpdateAction.NEVER ||
            this.#store.snapshot.isEmpty()
        ) {
            this.#store.shouldUpdateSnapshot();
        } else {
            this.#store.shouldCaptureIncrement();
        }
        this.#store.commit(arrayToMap(this.getNodes()), this.getAppState());
    }
}
```

Cada chamada a `api.record` adiciona um registro de histórico porque o estado do grafo de fato mudou, mas mudanças apenas de AppState não devem zerar o redoStack. Quando ocorre uma mudança, adicionamos a operação inversa da mudança ao undoStack:

```ts
export class History {
    record(elementsChange: ElementsChange, appStateChange: AppStateChange) {
        const entry = HistoryEntry.create(appStateChange, elementsChange);

        if (!entry.isEmpty()) {
            // 添加逆操作
            this.#undoStack.push(entry.inverse());
            if (!entry.elementsChange.isEmpty()) {
                this.#redoStack.length = 0;
            }
        }
    }
}
```

Agora dá para ver como projetar as estruturas de dados `AppStateChange` e `ElementsChange` para `Change`, o que permite usar um `entry.inverse()` genérico em vez de descrever cada atributo alterável com `add/removeFill`, `add/removeStroke` e assim por diante.

## Projetar a estrutura de mudança {#design-change-structure}

A interface `Change` no Excalidraw é bem simples:

```ts
export interface Change<T> {
    /**
     * Inverses the `Delta`s inside while creating a new `Change`.
     */
    inverse(): Change<T>;

    /**
     * Applies the `Change` to the previous object.
     *
     * @returns a tuple of the next object `T` with applied change, and `boolean`, indicating whether the applied change resulted in a visible change.
     */
    applyTo(previous: T, ...options: unknown[]): [T, boolean];

    /**
     * Checks whether there are actually `Delta`s.
     */
    isEmpty(): boolean;
}
```

As mudanças nos dois tipos de estado podem ser descritas por genéricos, em que `SceneElementsMap` é um `Map<SerializedNode[‘id’], SerializedNode>`:

```ts
class AppStateChange implements Change<AppState> {}
class ElementsChange implements Change<SceneElementsMap> {}
```

Vamos começar pelo `AppStateChange`, mais simples. O construtor dele é uma instância de `Delta` que recebe os atributos excluídos e os adicionados ou modificados. Se você precisar invertê-los, basta trocar a ordem dos dois:

```ts
class AppStateChange implements Change<AppState> {
    private constructor(private readonly delta: Delta<AppState>) {}

    inverse(): AppStateChange {
        const inversedDelta = Delta.create(
            this.delta.inserted,
            this.delta.deleted,
        );
        return new AppStateChange(inversedDelta);
    }
}

class Delta<T> {
    private constructor(
        public readonly deleted: Partial<T>,
        public readonly inserted: Partial<T>,
    ) {}
}
```

## Aplicar mudanças {#apply-changes}

```ts
export class ElementsChange implements Change<SceneElementsMap> {
    applyTo(
        elements: SceneElementsMap,
        snapshot: Map<string, SerializedNode>,
    ): [SceneElementsMap, boolean] {
        this.updated.forEach((delta, id) => {
            const { inserted, deleted } = delta;
            const element = nextElements.get(id);
            if (element) {
                Object.keys(deleted).forEach((key) => {
                    delete element[key];
                });
                Object.assign(element, inserted);
                this.api.updateNode(element, delta.inserted);
            }
        });
    }
}
```

[UI Algorithms: A Tiny Undo Stack]: https://blog.julik.nl/2025/03/a-tiny-undo-stack
[JavaScript-Undo-Manager]: https://github.com/ArthurClemens/JavaScript-Undo-Manager
[distinctKeysIterator]: https://github.com/excalidraw/excalidraw/blob/dff69e91912507bbfcc68b35277cc6031ce5b437/packages/excalidraw/change.ts#L359
[Lição 10]: /pt-BR/guide/lesson-010#shape-to-serialized-node
[State as a Snapshot]: https://react.dev/learn/state-as-a-snapshot
[Excalidraw HistoryEntry]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/history.ts#L160-L164
[captureUpdate]: https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api#captureupdate
