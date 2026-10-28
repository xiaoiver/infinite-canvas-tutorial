---
outline: deep
description: 'Implementa la funcionalidad de deshacer y rehacer con la gestión del historial. Aprende sobre las instantáneas del estado, las actualizaciones incrementales y el registro de entradas de historial para el soporte de la edición colaborativa.'
head:
    - ['meta', { property: 'og:title', content: 'Lección 19 - Historial' }]
---
<script setup>
import History from '../../components/History.vue';
</script>

# Lección 19 - Historial {#lesson-19-history}

En esta lección veremos cómo implementar las funciones relacionadas con el historial.

<History />

Tanto si se trata de un editor de texto como de un editor gráfico, el historial y la funcionalidad de deshacer y rehacer son imprescindibles. Como en la implementación de [JavaScript-Undo-Manager], podemos usar un undoStack para guardar cada operación y su inversa:

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

También podemos usar dos pilas para gestionar por separado las operaciones de deshacer y rehacer; consulta [Algoritmos de UI: una pila de deshacer minúscula]. La última sección de [Cómo funciona la tecnología multijugador de Figma] presenta el enfoque de implementación de Figma:

> Por eso, en Figma, una operación de deshacer modifica el historial de rehacer en el momento de deshacer, y del mismo modo una operación de rehacer modifica el historial de deshacer en el momento de rehacer.

Tomando como referencia [HistoryEntry de Excalidraw], añadimos una clase History para gestionar las operaciones de deshacer y rehacer.

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

Cada entrada de la pila de historial contiene dos tipos de modificaciones del estado del sistema, que describimos a continuación:

```ts
type HistoryStack = HistoryEntry[];
export class HistoryEntry {
    private constructor(
        public readonly appStateChange: AppStateChange,
        public readonly elementsChange: ElementsChange,
    ) {}
}
```

## Diseñar los estados {#design-states}

Tomando como referencia Excalidraw, dividimos el estado del sistema en `AppState` y `Elements`. El primero incluye el estado del lienzo y el de los componentes de la interfaz, como el tema actual, el nivel de zoom de la cámara, la configuración y la selección de las barras de herramientas, etc.

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

Como se ve, preferimos una estructura de datos plana a una estructura de objetos anidada como `{ penbar: { all: [], selected: [] } }`, para poder plantear el diff del estado de forma más rápida y sencilla, sin recursión; consulta [distinctKeysIterator].

El segundo es el array de formas del lienzo, que ya tratamos en la [Lección 10] en el contexto de la serialización de formas. Aquí usamos un array plano en lugar de una estructura de árbol, subimos los atributos del objeto `attributes` al nivel superior y representamos la relación padre-hijo de una forma ligeramente distinta, usando `parentId` para asociar el nodo padre con el `id`. Sin embargo, no basta con recorrer la estructura de árbol y renderizarla: hay que ordenar el array del grafo según algunas reglas, que veremos más adelante.

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

Pensando en la colaboración, más adelante añadiremos más atributos, como `version`.

## El estado como instantánea {#state-as-a-snapshot}

La imagen siguiente, de [El estado como instantánea], muestra cómo se ejecuta la función de renderizado de React y después toma una instantánea antes de actualizar el árbol del DOM:

![Instantánea de React](/react-snapshot.png)

Nuestra instantánea contiene los dos tipos de estado del sistema definidos arriba. En un momento dado solo hay una instantánea del sistema y, cada vez que el estado cambia, puedes calcular con la instantánea actual la modificación correspondiente del estado, por ejemplo «se eliminó un gráfico» en `ElementsChange`, «se seleccionó una capa» en `AppStateChange`, y así sucesivamente.

```ts
class Snapshot {
    private constructor(
        public readonly elements: Map<string, SerializedNode>,
        public readonly appState: AppState,
    ) {}
}
```

¿Cómo debe actualizar el sistema la instantánea? Desde el punto de vista de la estrategia, puedes elegir sobrescribir directamente o calcular una actualización incremental. excalidraw ofrece [captureUpdate] para describir estos dos comportamientos, que encajan en escenarios distintos; por ejemplo, la sobrescritura directa encaja en la inicialización de la escena, porque en ese momento no hace falta volver a un estado de lienzo en blanco.

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

Centrémonos en cómo calcular el incremento y usarlo para crear un `HistoryEntry`.

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

Veamos cómo añadir una entrada de historial.

## Registrar una entrada de historial {#record-history-entry}

En el ejemplo del principio de esta sección usamos la API para insertar dos historiales al actualizar el color de relleno del rectángulo, lo que puedes hacer con las operaciones de deshacer y rehacer de la barra de herramientas superior:

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

Cada llamada a `api.record` actualiza la instantánea con el estado actual de `AppState` y de `Elements`:

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

Cada llamada a `api.record` añade un registro de historial porque el estado del grafo sí cambió, pero es importante señalar que los cambios que solo afectan a AppState no deben reiniciar el redoStack. Cuando se produce un cambio, añadimos la operación inversa de ese cambio al undoStack:

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

Ahora podemos ver cómo diseñar las estructuras de datos `AppStateChange` y `ElementsChange` para `Change`, de modo que podamos usar un `entry.inverse()` genérico en lugar de describir cada atributo modificable con `add/removeFill`, `add/removeStroke`, etc.

## Diseñar la estructura de los cambios {#design-change-structure}

La interfaz `Change` de Excalidraw es muy sencilla:

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

Los cambios de los dos tipos de estado se pueden describir con genéricos, donde `SceneElementsMap` es un `Map<SerializedNode[‘id’], SerializedNode>`:

```ts
class AppStateChange implements Change<AppState> {}
class ElementsChange implements Change<SceneElementsMap> {}
```

Empecemos por el `AppStateChange` más sencillo, cuyo constructor es una instancia de `Delta` que acepta los atributos eliminados y los añadidos o modificados; si necesitas invertirlos, basta con intercambiar el orden de los dos:

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

## Aplicar los cambios {#apply-changes}

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

[Algoritmos de UI: una pila de deshacer minúscula]: https://blog.julik.nl/2025/03/a-tiny-undo-stack
[JavaScript-Undo-Manager]: https://github.com/ArthurClemens/JavaScript-Undo-Manager
[distinctKeysIterator]: https://github.com/excalidraw/excalidraw/blob/dff69e91912507bbfcc68b35277cc6031ce5b437/packages/excalidraw/change.ts#L359
[Lección 10]: /es/guide/lesson-010#shape-to-serialized-node
[El estado como instantánea]: https://react.dev/learn/state-as-a-snapshot
[HistoryEntry de Excalidraw]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/history.ts#L160-L164
[captureUpdate]: https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api#captureupdate
