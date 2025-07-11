---
outline: deep
description: 'Enable multi-user collaborative editing with CRDT (Conflict-free Replicated Data Types). Implement local-first software principles using Loro, fractional indexing, and real-time synchronization.'
head:
    - ['meta', { property: 'og:title', content: 'Lesson 20 - Collaboration' }]
---

<script setup>
import LoroCRDT from '../components/LoroCRDT.vue';
</script>

# Lesson 20 - Collaboration

In this lesson, we'll explore how to implement multi-user collaborative editing functionality.

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

在[课程 14]中，我们希望通过 `ZIndex` 干预渲染次序，在编辑器 UI 中会以“调整图层次序”、“上移”、“下移”这样的功能呈现。因此当 `ZIndex` 首次被添加或发生修改时，我们首先遍历场景图，对子节点按照 `ZIndex` 排序，得到排序后的数组后根据一前一后两个兄弟节点，更新当前节点的 fractional index

```ts
class ComputeZIndex extends System {
    private readonly zIndexes = this.query(
        (q) => q.addedOrChanged.with(ZIndex).trackWrites,
    );

    execute() {
        this.zIndexes.addedOrChanged.forEach((entity) => {
            // Travese scenegraph, sort children by z-index
            const descendants = getDescendants(
                getSceneRoot(entity),
                sortByZIndex,
            );
            const index = descendants.indexOf(entity);
            const prev = descendants[index - 1] || null;
            const next = descendants[index + 1] || null;
            const prevFractionalIndex =
                (prev?.has(FractionalIndex) &&
                    prev.read(FractionalIndex)?.value) ||
                null;
            const nextFractionalIndex =
                (next?.has(FractionalIndex) &&
                    next.read(FractionalIndex)?.value) ||
                null;

            // Generate fractional index with prev and next node
            const key = generateKeyBetween(
                prevFractionalIndex, // a0
                nextFractionalIndex, // a2
            );

            if (!entity.has(FractionalIndex)) {
                entity.add(FractionalIndex);
            }
            entity.write(FractionalIndex).value = key; // a1
        });
    }
}
```

这样在渲染前就可以根据 fractional index 排序，值得一提的是不可以直接使用 [localeCompare] 比较：

```ts
export function sortByFractionalIndex(a: Entity, b: Entity) {
    if (a.has(FractionalIndex) && b.has(FractionalIndex)) {
        const aFractionalIndex = a.read(FractionalIndex).value;
        const bFractionalIndex = b.read(FractionalIndex).value;

        // Can't use localeCompare here.
        // @see https://github.com/rocicorp/fractional-indexing/issues/20
        if (aFractionalIndex < bFractionalIndex) return -1;
        if (aFractionalIndex > bFractionalIndex) return 1;
        return 0;
    }

    return 0;
}
```

### Listen to Scene Graph Changes {#listen-scene-graph-change}

```tsx
<Excalidraw
    onChange={(elements) => {
        const v = getVersion(elements);
    }}
/>
```

```ts
api.onchange = (snapshot) => {
    const { appState, elements } = snapshot;
};
```

### Apply Scene Graph Changes {#apply-scene-graph-change}

Referring to [Excalidraw updateScene], we can also provide an `updateNodes` method to update the scene graph.

```ts
api.updateNodes(nodes);
```

<LoroCRDT />

<br />

<LoroCRDT />

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
