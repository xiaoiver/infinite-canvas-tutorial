---
outline: deep
publish: false
---

<script setup>
import History from '../components/History.vue';
import LoroCRDT from '../components/LoroCRDT.vue';
</script>

# Lesson 19 - History and collaboration

In this lesson, we'll explore how to implement multi-user collaborative editing functionality. We'll introduce several core concepts and technologies, including history records, Local-first, and CRDT.

## History {#history}

<History />

Whether you are a text or graphical editor, the history and undo redo functionality is a must. As implemented in [JavaScript-Undo-Manager], we can use an undoStack to save each operation and its inverse:

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

We can also use two stacks to manage undo and redo operations separately, see: [UI Algorithms: A Tiny Undo Stack]. The last section of [How Figma's multiplayer technology works] introduces Figma's implementation approach:

> This is why in Figma an undo operation modifies redo history at the time of the undo, and likewise a redo operation modifies undo history at the time of the redo.

Referring to [Excalidraw HistoryEntry], we add a History class to manage undo and redo operations.

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

Each entry in the history stack contains two types of modifications to the system state, which we describe below:

```ts
type HistoryStack = HistoryEntry[];
export class HistoryEntry {
    private constructor(
        public readonly appStateChange: AppStateChange,
        public readonly elementsChange: ElementsChange,
    ) {}
}
```

### Desgin states {#design-states}

Referring to Excalidraw, we split the system state into `AppState` and `Elements`. The former includes the state of the canvas as well as the UI components, such as the current theme, the camera zoom level, the toolbar configurations and selections, etc.

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

As you can see, we prefer to use a flat data structure rather than a nested object structure like `{ penbar: { all: [], selected: [] } }`, in order to allow for quicker and easier state diff considerations that don't require recursion, see: [distinctKeysIterator].

The latter is the array of shapes in the canvas, which we previously covered in [Lesson 10] in the context of serializing shapes. Here we use a flat array instead of a tree structure, move the attributes in the `attributes` object up to the top level, and represent the parent-child relationship slightly differently, using `parentId` to associate the parent node with the `id`. However, we can't just traverse the tree structure and render it, we need to sort the graph array according to some rules, which we'll cover later:

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

Consider collaboration we'll add more attributes like `version` later on. Let's see how to add a history entry.

### Record a history entry {#record-history-entry}

In the example at the top of this section, we used the API to insert two histories for updating the fill color of the rectangle, which you can do using the undo and redo operations in the top toolbar:

```ts
api.updateNode(node, {
    fill: 'red',
});
api.updateNode(node, {
    fill: 'blue',
});
```

Each call to `api.updateNode` adds a history record because the state of the graph did change, but it is important to note that only AppState changes should not reset the redoStack. when a change occurs we add the inverse operation of the change to the undoStack:

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

Now we can look at how to design the `AppStateChange` and `ElementsChange` data structures for `Change`, allowing us to use a generic `entry.inverse()` instead of describing each changeable attribute with `add/removeFill` `add/removeStroke` and so on.

### Desgin change structure {#design-change-structure}

The `Change` interface in Excalidraw is very simple:

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

What is CRDT? The following introduction comes from [What are CRDTs]. The collaborative features of Google Docs / Figma / Tiptap are all implemented based on it. This article also compares the characteristics of CRDT and OT in detail:

> CRDT (conflict-free replicated data type) is a data structure that can be replicated across multiple computers in a network, where replicas can be updated independently and in parallel, without the need for coordination between replicas, and with a guarantee that no conflicts will occur.

The following image from [What are CRDTs] shows that under the CAP theorem, CRDT doesn't provide "perfect consistency" but eventual consistency. Although real-time consistency cannot be guaranteed, when two nodes synchronize messages, they will return to a consistent state.

![CRDT satisfies A + P + Eventual Consistency; a good tradeoff under CAP](https://loro.dev/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fa4858e2a50bc1a2d79722060156e89b0cac5815cf25e8c67e409aa0926280cef.6a607785.png&w=3840&q=75)

[How Figma's multiplayer technology works] explains why Figma didn't choose OT like Google Docs.

> It's also worth noting that Figma's data structure isn't a single CRDT. Instead it's inspired by multiple separate CRDTs and uses them in combination to create the final data structure that represents a Figma document (described below).

### Two Types of CRDTs {#two-types-of-crdts}

There are two types of CRDTs: Op-based and State-based. The principle of the former is that if two users execute the same sequence of operations, the final state of the document should also be the same. To achieve this, each user maintains all operations executed on the data and synchronizes these operations with other users to ensure the final state. The latter requires transferring the entire state between nodes. While the former appears to require less bandwidth as it only transmits operation descriptions, it requires complex implementation to ensure idempotent operations and handle operation order issues. Comparatively, the latter's implementation is simpler.

Now let's understand State-based CRDT through this tutorial series:

-   [An Interactive Intro to CRDTs]
-   [Building a Collaborative Pixel Art Editor with CRDTs]
-   [Making CRDTs 98% More Efficient]

The tutorial provides a generic data structure for CRDT that includes a merge function that must satisfy associativity, commutativity, and idempotency. This merge function can be a Last-Writer Wins(LWW) Register, which compares its own timestamp with the input data's timestamp each time, and updates its own data if the input data's timestamp is larger:

```ts
interface CRDT<T, S> {
    value: T;
    state: S;
    merge(state: S): void;
}
```

Key-value style sheets are well-suited for using LWW Register. [Designing Data Structures for Collaborative Apps] introduces the `{bold: true}` style used by the Quill editor.

More helpful for our scenario is [How Figma's multiplayer technology works], where Figma's CTO introduces the DOM-like tree structure (scene graph) used internally. Each object has an ID and a set of property values, which can be seen as a two-level mapping: `Map<ObjectID, Map<Property, Value>>`. Different merge strategies are adopted when handling object properties, object addition/deletion, order, and other issues:

-   Modifying the same property of an object. For example, when two users modify the property value of the same text object to AB and BC respectively, Figma won't use a merge algorithm to get ABC as the result, but depends on when the server receives the messages.
-   Object addition/deletion. Creating objects directly uses LWW Register. The difference from the CRDT model is in the behavior when deleting objects - Figma's server doesn't save the properties of deleted objects but lets the client handle storage for potential undo operations.
-   Scene graph structure changes. Child nodes reference parent node IDs through properties, and positions in the node list are implemented using Fractional indexing. The advantage is that changing position only requires updating one value, see: [Realtime editing of ordered sequences]. One defect of this solution, interleaving, is also not considered.

### Local-first Software {#local-first-software}

[Local-first software - You own your data, in spite of the cloud]

> In this article we propose "local-first software": a set of principles for software that enables both collaboration and ownership for users. Local-first ideals include the ability to work offline and collaborate across multiple devices, while also improving the security, privacy, long-term preservation, and user control of data.

The following image from [The past, present, and future of local-first] shows that this software development and data management philosophy of Local first can also be implemented based on CRDT.

![History of local-first](/local-first-history.png)

[How Figma's multiplayer technology works]

> Figma lets you go offline for an arbitrary amount of time and continue editing. When you come back online, the client downloads a fresh copy of the document, reapplies any offline edits on top of this latest state, and then continues syncing updates over a new WebSocket connection.

Rich text editors and code editors also support this, see [TipTap offline support] and [The Full Spectrum of Collaboration].

### Implementation of CRDTs {#implementation-of-crdts}

Y.js and its ports to other languages are undoubtedly the most famous CRDT implementations. The following text is from <https://tiptap.dev/docs/collaboration/getting-started/overview#about-yjs>

> As a CRDT, Y.js ensures that the sequence of changes does not impact the final state of the document, similar to how Git operates with commits. This guarantees that all copies of the data remain consistent across different environments.

Since we don't need to deal with merging text or rich text in collaborative states, we only need simple data structures to store the canvas state, such as [Y.Map]. Other CRDT implementations also provide similar APIs, for example:

-   Liveblocks provides `LiveObject/List/Map`, see: [Data Structures in Liveblocks]
-   Automerge provides [Simple Values], supporting all legal types in JSON, even including `Date`
-   Loro also provides [Map]

Now let's refer to [Loro Excalidraw Example] and [dgmjs-plugin-yjs], using [BroadcastChannel]'s feature of supporting communication between multiple tabs under the same origin to simulate the effect of multiple users collaborating.

## Implementation {#implementation}

As mentioned earlier, the scene graph can be viewed as a "movable tree", with possible conflicts including three scenarios: addition, deletion, and movement. [Movable tree CRDTs and Loro's implementation] details Loro's implementation approach for these three scenarios. For instance, when deleting and moving the same node, both results are acceptable, depending on the order in which the server receives the messages. However, some operation scenarios may create cycles after synchronization, such as when two users perform `B -> C` and `C -> B` operations respectively, breaking the tree's structural definition.

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

[Realtime editing of ordered sequences] introduces how Figma uses [fractional-indexing] to reflect element positions in the scene graph.

![An example sequence of objects being edited](https://cdn.sanity.io/images/599r6htc/regionalized/dc3ac373a86b1d25629d651e2b75100dc3d9fbb9-1400x1144.png?w=804&q=75&fit=max&auto=format&dpr=2)

Excalidraw also uses the same implementation:

```ts
// @see https://github.com/excalidraw/excalidraw/blob/9ee0b8ffcbd3664a47748a93262860321a203821/packages/excalidraw/fractionalIndex.ts#L380
import { generateNKeysBetween } from 'fractional-indexing';
const fractionalIndices = generateNKeysBetween(
    elements[lowerBoundIndex]?.index,
    elements[upperBoundIndex]?.index,
    indices.length,
) as FractionalIndex[];
```

Loro's built-in Tree includes the Fractional Index algorithm, see: [Movable tree CRDTs and Loro's implementation].

> We integrated the Fractional Index algorithm into Loro and combined it with the movable tree, making the child nodes of the movable tree sortable.

### Listen to Scene Graph Changes {#listen-scene-graph-change}

```tsx
<Excalidraw
    onChange={(elements) => {
        const v = getVersion(elements);
    }}
/>
```

### Apply Scene Graph Changes {#apply-scene-graph-change}

Referring to [Excalidraw updateScene], we can also provide an `updateScene` method to update the scene graph.

```ts
canvas.updateScene({ elements });
```

## Extended Reading {#extended-reading}

-   [How Figma's multiplayer technology works]
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
[How Figma's multiplayer technology works]: https://www.figma.com/blog/how-figmas-multiplayer-technology-works/
[Realtime editing of ordered sequences]: https://www.figma.com/blog/realtime-editing-of-ordered-sequences/#fractional-indexing
[BroadcastChannel]: https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel
[Excalidraw updateScene]: https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api#updatescene
[fractional-indexing]: https://github.com/rocicorp/fractional-indexing
[Movable tree CRDTs and Loro's implementation]: https://loro.dev/blog/movable-tree
[UI Algorithms: A Tiny Undo Stack]: https://blog.julik.nl/2025/03/a-tiny-undo-stack
[JavaScript-Undo-Manager]: https://github.com/ArthurClemens/JavaScript-Undo-Manager
[distinctKeysIterator]: https://github.com/excalidraw/excalidraw/blob/dff69e91912507bbfcc68b35277cc6031ce5b437/packages/excalidraw/change.ts#L359
[Lesson 10]: /guide/lesson-010#shape-to-serialized-node
