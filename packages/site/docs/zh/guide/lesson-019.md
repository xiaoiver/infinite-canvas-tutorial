---
outline: deep
publish: false
---

<script setup>
import History from '../../components/History.vue';
import LoroCRDT from '../../components/LoroCRDT.vue';
</script>

# 课程 19 - 历史记录与协同

在本课程中，我们将探讨如何实现多人协同编辑功能。我们会介绍几个核心概念和技术，包括历史记录、本地优先（Local-first）以及 CRDT。

## 历史记录 {#history}

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

### 设计系统状态 {#design-states}

参考 Excalidraw，我们把系统状态分成 AppState 和 Elements。前者包括画布以及 UI 组件的状态，例如当前主题、相机缩放等级、工具条配置和选中情况等等。

```ts
export interface AppState {
    theme: Theme;
    checkboardStyle: CheckboardStyle;
    cameraZoom: number;
    penbarAll: Pen[];
    penbarSelected: Pen[];
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

考虑协同我们稍后还会添加 `version` 等属性。下面我们来看如何添加一条历史记录。

### 插入历史记录 {#record-history-entry}

在本节最上面的例子中，我们使用 API 插入了两条历史记录用来更新矩形的填充色，你可以使用顶部工具条的 undo 和 redo 操作：

```ts
api.updateNode(node, {
    fill: 'red',
});
api.updateNode(node, {
    fill: 'blue',
});
```

每次调用 `api.updateNode` 都会增加一条历史记录，因为图形的状态确实发生了改变，但需要注意的是仅发生 AppState 的修改不应该重置 redoStack。发生变更时，我们将变更的逆操作添加到 undoStack 中：

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

### 设计变更数据结构 {#design-change-structure}

Excalidraw 中的 `Change` 接口十分简单：

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

```ts
class AppStateChange implements Change<AppState> {}
class ElementsChange implements Change<SceneElementsMap> {}
```

## CRDT {#crdt}

什么是 CRDT 呢？下面的介绍来自 [What are CRDTs]，Google Docs / Figma / Tiptap 的协同功能都是基于它实现的，这篇文章还详细对比了 CRDT 和 OT 的特点：

> CRDT (conflict-free replicated data type) is a data structure that can be replicated across multiple computers in a network, where replicas can be updated independently and in parallel, without the need for coordination between replicas, and with a guarantee that no conflicts will occur.

下图来自 [What are CRDTs]，它展示了 CAP 定理下，CRDT 不提供“完美的一致性”，而是最终的一致性。虽然无法保证实时一致，但当两个节点同步消息时，会恢复到一致性状态。

![CRDT satisfies A + P + Eventual Consistency; a good tradeoff under CAP](https://loro.dev/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fa4858e2a50bc1a2d79722060156e89b0cac5815cf25e8c67e409aa0926280cef.6a607785.png&w=3840&q=75)

[How Figma’s multiplayer technology works] 一文介绍了 Figma 没有像 Google Docs 那样选择 OT 的原因。

> It’s also worth noting that Figma's data structure isn't a single CRDT. Instead it's inspired by multiple separate CRDTs and uses them in combination to create the final data structure that represents a Figma document (described below).

### CRDT 的两种类型 {#two-types-of-crdts}

CRDT 有两种类型：Op-based 和 State-based。前者的原理是，如果两个用户执行相同的操作序列，则文档的最终状态也应相同。为此，每个用户保存了对数据（操作）执行的所有操作，并将这些操作与其他用户同步，以确保最终状态。而后者需要在节点间传递整个状态。看上去前者需要传递的数据量更少更节省带宽，毕竟只是操作的描述，但这要求前者通过复杂实现保证幂等的操作和处理操作的顺序问题，相对来说后者的实现会更简单。

现在让我们通过下面这个系列教程来了解 State-based CRDT：

-   [An Interactive Intro to CRDTs]
-   [Building a Collaborative Pixel Art Editor with CRDTs]
-   [Making CRDTs 98% More Efficient]

教程给出了一个 CRDT 的通用数据结构，它包括一个必须满足结合律、交换律和幂等性的合并函数。这个合并函数可以是一个 Last-Writer Wins(LWW) Register，每次对比自身和输入数据的时间戳，如果输入数据的时间戳更大，则更新自身数据：

```ts
interface CRDT<T, S> {
    value: T;
    state: S;
    merge(state: S): void;
}
```

键值对形式的样式表就很适合使用 LWW Register。[Designing Data Structures for Collaborative Apps] 一文介绍了 Quill 编辑器使用的 `{bold: true}` 样式。

对我们的场景更有帮助的是 [How Figma’s multiplayer technology works] 一文，Figma CTO 介绍了内部实现使用的类 DOM 树形结构（场景图），每个对象都有一个 ID 和一组属性值，可以看作是一个两级映射：`Map<ObjectID, Map<Property, Value>>`。在处理对象属性、对象增删、顺序等问题时采取不同的合并策略：

-   修改对象的同一个属性。例如两个用户分别将同一个文本对象的属性值修改为 AB 和 BC，Figma 是不会使用合并算法得出 ABC 的结果的，而是取决于服务器收到消息的时间。
-   对象删减。创建对象直接使用 LWW Register。和 CRDT 模型的不同点在于删除对象时的行为，Figma 服务端不会保存被删除对象的属性，而是让客户端负责存储以便实现后续可能的 undo 操作。
-   场景图结构变动。子节点通过属性引用父节点的 ID，在节点列表中的位置使用 Fractional indexing 实现，优点是更改位置只需要更新一个值，详见：[Realtime editing of ordered sequences]，该方案的缺陷之一 interleaving 同样不考虑。

### Local-first 软件 {#local-first-software}

[Local-first software - You own your data, in spite of the cloud]

> In this article we propose “local-first software”: a set of principles for software that enables both collaboration and ownership for users. Local-first ideals include the ability to work offline and collaborate across multiple devices, while also improving the security, privacy, long-term preservation, and user control of data.

下图来自 [The past, present, and future of local-first]，可以看出 Local first 这种软件开发和数据管理的理念也可以基于 CRDT 实现。

![History of local-first](/local-first-history.png)

[How Figma’s multiplayer technology works]

> Figma lets you go offline for an arbitrary amount of time and continue editing. When you come back online, the client downloads a fresh copy of the document, reapplies any offline edits on top of this latest state, and then continues syncing updates over a new WebSocket connection.

富文本编辑器和代码编辑器也都支持，详见 [TipTap offline support] 和 [The Full Spectrum of Collaboration]。

### CRDT 的实现 {#implementation-of-crdts}

Y.js 及其他语言的移植版本无疑是最著名的 CRDT 实现，下文来自 <https://tiptap.dev/docs/collaboration/getting-started/overview#about-yjs>

> As a CRDT, Y.js ensures that the sequence of changes does not impact the final state of the document, similar to how Git operates with commits. This guarantees that all copies of the data remain consistent across different environments.

由于不涉及协同状态下文本或者富文本的合并，我们只需要用到简单的数据结构存储画布的状态，例如 [Y.Map]。其他 CRDT 实现也都提供了类似的 API，例如：

-   Liveblocks 提供了 `LiveObject/List/Map`，详见：[Data Structures in Liveblocks]
-   Automerge 提供了 [Simple Values]，支持 JSON 中的全部合法类型，甚至还包括 `Date`
-   Loro 也提供了 [Map]

下面我们参考 [Loro Excalidraw Example] 和 [dgmjs-plugin-yjs]，使用 [BroadcastChannel] 支持同源下多个标签页间通讯的特性，模拟多个用户协同编辑的效果。

## 实现 {#implementation}

正如前文提到的，场景图可以看作一个 "movable tree"，可能的冲突包括新增、删除和移动这三种场景。[Movable tree CRDTs and Loro's implementation] 一文详细介绍了这三种场景下 Loro 的实现思路。比如删除和移动同一个节点，此时两种结果都可以接受，取决于服务端接收到消息的顺序。但有些操作场景同步后会造成环，比如两个用户分别进行 `B -> C` 和 `C -> B` 操作，破坏树本身的结构定义。

![Deletion and Movement of the Same Node](https://loro.dev/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fmove-delete-dark.17378273.png&w=3840&q=75)

```ts
import { Loro, LoroTree, LoroTreeNode } from 'loro-crdt';

let doc = new Loro();
let tree: LoroTree = doc.getTree('tree');
let root: LoroTreeNode = tree.createNode();
```

<LoroCRDT />

<br />

<LoroCRDT />

### fractional-indexing

[Realtime editing of ordered sequences] 中介绍了 Figma 使用 [fractional-indexing] 反映元素在场景图中的位置。

![An example sequence of objects being edited](https://cdn.sanity.io/images/599r6htc/regionalized/dc3ac373a86b1d25629d651e2b75100dc3d9fbb9-1400x1144.png?w=804&q=75&fit=max&auto=format&dpr=2)

Excalidraw 也使用了同样的实现：

```ts
// @see https://github.com/excalidraw/excalidraw/blob/9ee0b8ffcbd3664a47748a93262860321a203821/packages/excalidraw/fractionalIndex.ts#L380
import { generateNKeysBetween } from 'fractional-indexing';
const fractionalIndices = generateNKeysBetween(
    elements[lowerBoundIndex]?.index,
    elements[upperBoundIndex]?.index,
    indices.length,
) as FractionalIndex[];
```

Loro 提供的 Tree 内置了 Fractional Index 算法，详见：[Movable tree CRDTs and Loro's implementation]。

> We integrated the Fractional Index algorithm into Loro and combined it with the movable tree, making the child nodes of the movable tree sortable.

### 监听场景图变更 {#listen-scene-graph-change}

```tsx
<Excalidraw
    onChange={(elements) => {
        const v = getVersion(elements);
    }}
/>
```

### 应用场景图变更 {#apply-scene-graph-change}

参考 [Excalidraw updateScene]，我们也可以提供一个 `updateScene` 方法，用于更新场景图。

```ts
canvas.updateScene({ elements });
```

## 扩展阅读 {#extended-reading}

-   [How Figma’s multiplayer technology works]
-   [Movable tree CRDTs and Loro's implementation]
-   [Learn Yjs]
-   [CRDTs: The Hard Parts]
-   [An Interactive Intro to CRDTs]
-   [The Full Spectrum of Collaboration]

[What are CRDTs]: https://loro.dev/docs/concepts/crdt
[CRDTs: The Hard Parts]: https://www.youtube.com/watch?v=x7drE24geUw
[Local-first software - You own your data, in spite of the cloud]: https://www.inkandswitch.com/local-first/
[Loro Excalidraw Example]: https://github.com/loro-dev/loro-excalidraw
[Excalidraw HistoryEntry]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/history.ts#L160-L164
[The past, present, and future of local-first]: https://speakerdeck.com/ept/the-past-present-and-future-of-local-first
[TipTap offline support]: https://tiptap.dev/docs/guides/offline-support
[An Interactive Intro to CRDTs]: https://jakelazaroff.com/words/an-interactive-intro-to-crdts/
[Building a Collaborative Pixel Art Editor with CRDTs]: https://jakelazaroff.com/words/building-a-collaborative-pixel-art-editor-with-crdts/
[Making CRDTs 98% More Efficient]: https://jakelazaroff.com/words/making-crdts-98-percent-more-efficient/
[Learn Yjs]: https://learn.yjs.dev/
[dgmjs-plugin-yjs]: https://github.com/dgmjs/dgmjs/tree/main/packages/dgmjs-plugin-yjs
[Designing Data Structures for Collaborative Apps]: https://mattweidner.com/2022/02/10/collaborative-data-design.html
[The Full Spectrum of Collaboration]: https://zed.dev/blog/full-spectrum-of-collaboration
[Data Structures in Liveblocks]: https://liveblocks.io/docs/api-reference/liveblocks-client#Data-structures
[Y.Map]: https://docs.yjs.dev/api/shared-types/y.map
[Simple Values]: https://automerge.org/docs/documents/values/
[Map]: https://loro.dev/docs/tutorial/map
[How Figma’s multiplayer technology works]: https://www.figma.com/blog/how-figmas-multiplayer-technology-works/
[Realtime editing of ordered sequences]: https://www.figma.com/blog/realtime-editing-of-ordered-sequences/#fractional-indexing
[BroadcastChannel]: https://developer.mozilla.org/zh-CN/docs/Web/API/BroadcastChannel
[Excalidraw updateScene]: https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api#updatescene
[fractional-indexing]: https://github.com/rocicorp/fractional-indexing
[Movable tree CRDTs and Loro's implementation]: https://loro.dev/blog/movable-tree
[UI Algorithms: A Tiny Undo Stack]: https://blog.julik.nl/2025/03/a-tiny-undo-stack
[JavaScript-Undo-Manager]: https://github.com/ArthurClemens/JavaScript-Undo-Manager
[distinctKeysIterator]: https://github.com/excalidraw/excalidraw/blob/dff69e91912507bbfcc68b35277cc6031ce5b437/packages/excalidraw/change.ts#L359
[课程 10]: /zh/guide/lesson-010#shape-to-serialized-node
