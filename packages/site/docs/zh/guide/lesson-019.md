---
outline: deep
description: '实现撤销/重做功能和历史记录管理。学习状态快照、增量更新以及记录历史条目的技术，为协同编辑提供支持。'
---

<script setup>
import History from '../../components/History.vue';
</script>

# 课程 19 - 历史记录

在本课程中，我们将探讨如何实现历史记录相关的功能。

<History />

无论是文本还是图形编辑器，历史记录以及撤销重做功能都是必备的。正如 [JavaScript-Undo-Manager] 的实现，我们可以使用一个 undoStack 保存每次操作和它的逆操作：

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

我们也可以使用两个 stack 分别管理 undo 和 redo 操作，详见：[UI Algorithms: A Tiny Undo Stack]。Figma 也采用了这种方式，详见：[How Figma’s multiplayer technology works] 一文最后一节介绍了 Figma 的实现思路：

> This is why in Figma an undo operation modifies redo history at the time of the undo, and likewise a redo operation modifies undo history at the time of the redo.

参考 [Excalidraw HistoryEntry]，我们增加一个 History 类，持有两个 stack 用于管理撤销和重做。

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

历史记录栈中的每一个条目包含两类系统状态的修改，下面我们来介绍这两类状态：

```ts
type HistoryStack = HistoryEntry[];
export class HistoryEntry {
    private constructor(
        public readonly appStateChange: AppStateChange,
        public readonly elementsChange: ElementsChange,
    ) {}
}
```

## 设计系统状态 {#design-states}

参考 Excalidraw，我们把系统状态分成 AppState 和 Elements。前者包括画布以及 UI 组件的状态，例如当前主题、相机缩放等级、工具条配置和选中情况等等。

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

可以看出这里我们倾向于使用扁平的数据结构，而非 `{ penbar: { all: [], selected: [] } }` 这样的嵌套对象结构，这是为了后续更方便快速地进行状态 diff 考虑，不需要使用递归，详见：[distinctKeysIterator]。

而后者就是画布中的图形数组了，之前在 [课程 10] 中我们介绍过图形的序列化方案。这里我们使用扁平的数组而非树形结构，把 `attributes` 对象中的属性上移到最顶层，在父子关系的表示上稍有不同，使用 `parentId` 关联父节点的 `id`。但这样我们就没法直接遍历树形结构进行渲染了，需要按照某种规则对图形数组排序，稍后我们会介绍这种方法：

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

考虑协同我们稍后还会添加 `version` 等属性。有了这两种系统状态，我们就可以定义当前系统的快照。

## 定义快照 {#state-as-a-snapshot}

下图来自 [State as a Snapshot]，展示了 React render 函数执行后，先生成快照再更新 DOM 树的过程：

![React snapshot](/react-snapshot.png)

我们的快照就包含上面定义的两类系统状态，系统任意时刻只会有一张快照，每次状态发生改变时，可以与当前快照计算得到状态对应的修改，例如 `ElementsChange` 中 “删除了一个图形”，`AppStateChange` 中 “选中了一个图层” 等等：

```ts
class Snapshot {
    private constructor(
        public readonly elements: Map<string, SerializedNode>,
        public readonly appState: AppState,
    ) {}
}
```

那系统应该如何更新快照呢？在策略上可以选择直接覆盖，或者计算增量更新。Excalidraw 提供了 [captureUpdate] 描述这两种行为，这两种行为适合不同的场景，比如直接覆盖适合场景初始化的场景，毕竟此时不需要回退到空白画布状态：

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

我们着重来看如何计算增量，并使用它创建 `HistoryEntry`。

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

        // 使用 history.record 创建 HistoryEntry
    }
}
```

下面我们来看如何添加一条历史记录。

## 插入历史记录 {#record-history-entry}

在本节最上面的例子中，我们使用 API 插入了两条历史记录用来更新矩形的填充色，你可以使用顶部工具条的 undo 和 redo 操作在两种颜色间切换：

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

每次调用 `api.record` 会使用当前的 `AppState` 和 `Elements` 状态更新快照：

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

如果是增量更新模式，就会增加一条历史记录，因为图形的状态确实发生了改变，但需要注意的是仅发生 AppState 的修改不应该重置 redoStack。发生变更时，我们将变更的逆操作添加到 undoStack 中：

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

现在我们可以来看如何设计“变更”的数据结构 `AppStateChange` 和 `ElementsChange`，让我们可以用一种通用的 `entry.inverse()`，而不是针对每一个可变更属性都用 `add/removeFill` `add/removeStroke` 等等来描述。

## 设计变更数据结构 {#design-change-structure}

Excalidraw 中的 `Change` 接口十分简单：

```ts
export interface Change<T> {
    /**
     * Inverses the `Delta`s inside while creating a new `Change`.
     */
    inverse(): Change<T>;
    /**
     * Applies the `Change` to the previous object.
     */
    applyTo(previous: T, ...options: unknown[]): [T, boolean];
    /**
     * Checks whether there are actually `Delta`s.
     */
    isEmpty(): boolean;
}
```

两类状态的变更可以通过泛型描述，其中 `SceneElementsMap` 就是一个 `Map<SerializedNode['id'], SerializedNode>`：

```ts
class AppStateChange implements Change<AppState> {}
class ElementsChange implements Change<SceneElementsMap> {}
```

下面我们先来看比较简单的 `AppStateChange`，它的构造函数是一个 `Delta` 实例，接受被删除和加入/修改的属性，如果需要反转只需要调换一下两者的顺序：

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

[How Figma’s multiplayer technology works]: https://www.figma.com/blog/how-figmas-multiplayer-technology-works/
[UI Algorithms: A Tiny Undo Stack]: https://blog.julik.nl/2025/03/a-tiny-undo-stack
[JavaScript-Undo-Manager]: https://github.com/ArthurClemens/JavaScript-Undo-Manager
[distinctKeysIterator]: https://github.com/excalidraw/excalidraw/blob/dff69e91912507bbfcc68b35277cc6031ce5b437/packages/excalidraw/change.ts#L359
[课程 10]: /zh/guide/lesson-010#shape-to-serialized-node
[State as a Snapshot]: https://zh-hans.react.dev/learn/state-as-a-snapshot
[Excalidraw HistoryEntry]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/history.ts#L160-L164
[captureUpdate]: https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api#captureupdate
