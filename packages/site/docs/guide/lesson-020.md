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

-   Classification and implementation of CRDTs
-   An example of collaborative editing using Loro
-   End-to-End encrypted CRDTs
-   Implementation of multiplayer cursors

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

In [Lesson 14], we aim to manipulate the rendering order through `ZIndex`. In the editor UI, this functionality manifests as features like “Adjust Layer Order,” “Move Up,” and “Move Down.” Therefore, when `ZIndex` is first added or modified, we first traverse the scene graph, sorting child nodes by `ZIndex`. After obtaining the sorted array, we update the current node's fractional index based on its two immediate sibling nodes.

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

This allows sorting based on fractional indices before rendering. It's worth noting that you cannot directly use `[localeCompare]` for comparison:

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

In Excalidraw, you can use the `onChange` hook to monitor changes to all shapes in the scene:

```tsx
<Excalidraw
    onChange={(elements) => {
        const v = getVersion(elements);
    }}
/>
```

When the history records changed, we invoke this hook:

```ts
export class API {
    onchange: (snapshot: {
        appState: AppState;
        nodes: SerializedNode[];
    }) => void;
}

api.onchange = (snapshot) => {
    const { appState, nodes } = snapshot;
};
```

### Apply Scene Graph Changes {#apply-scene-graph-change}

Referring to [Excalidraw updateScene], we can also provide an `updateNodes` method to update the scene graph.

```ts
api.updateNodes(nodes);
```

Below, we use Loro as an example to simulate the effect of multiple users collaborating on editing. We leverage the [BroadcastChannel] feature to enable communication between multiple tabs within the same origin. Whenever the canvas content changes, a message is sent to other pages. Upon receiving a message from another page, synchronization is completed. Therefore, each page must simultaneously act as both a message sender and receiver.

First, let's examine the code implementation for the message receiver: First, create a [LoroDoc] instance. Use a [List] structure to store the graphic list. Upon receiving a message, import the data into the LoroDoc. For reference, see [Exporting and Importing].

```ts
import { LoroDoc } from 'loro-crdt';

const channel = new BroadcastChannel('loro-crdt');
const doc = new LoroDoc();
const docNodes = doc.getList('nodes');

channel.onmessage = (e) => {
    const bytes = new Uint8Array(e.data);
    doc.import(bytes);
};
```

Furthermore, after converting `docNodes` into a JavaScript object, call the canvas API `updateNodes` to complete the scene update:

```ts
doc.subscribe((e) => {
    if (e.by !== 'local') {
        api.updateNodes(docNodes.toJSON());
    }
});
```

Now let's examine the implementation on the message-sending side. By subscribing to changes in the canvas scene graph via the `onchange` hook, changes are recorded to the document and submitted. This triggers the previous scene update in other windows:

```ts
api.onchange = (snapshot) => {
    const { appState, nodes } = snapshot;
    if (recordLocalOps(docElements, nodes)) {
        doc.commit();
    }
};
```

During the submission of local changes:

```ts
function recordLocalOps(
    loroList: LoroList,
    nodes: readonly { version?: number; isDeleted?: boolean }[],
): boolean {
    nodes = nodes.filter((e) => !e.isDeleted); // 首先排除掉被删除的图形
}
```

In the example below, you can freely drag, resize, or change the color of the rectangle in either the left or right window, and the other window will synchronize these modifications:

<div style="display:flex;flex-direction:row;">
<div style="flex: 1;">
<LoroCRDT />
</div>
<div style="flex: 1;">
<LoroCRDT />
</div>
</div>

### Sync server {#sync-server}

The implementation based on BroadcastChannel above is, after all, just a simple example.

[firestore]

## End to end encryption {#end-to-end-encryption}

Now we can store documents as CRDTs and use some kind of synchronization server to merge updates and forward them, while ensuring this file remains private.

In the paper [End-to-End Encryption in the Browser], Excalidraw introduces a simple end-to-end encryption approach that enables communication between various clients while preventing the server from reading the content. The encrypted data is placed in the link hash portion, which the server cannot read, and is decoded only on the client side: <https://excalidraw.com/#json=5645858175451136,8w-G0ZXiOfRYAn7VWpANxw>

Next, we'll analyze how Excalidraw utilizes the Web Crypto API to implement its functionality.

### Generate key {#generate-key}

Use the [generateKey] API to select the [AES-GCM] algorithm and generate a random key. The `extractable` parameter indicates that the key can later be exported in an externally portable format via the [exportKey] API. For example, here we select the [JSON Web Key] `‘jwk’` format:

```ts
// @see https://github.com/excalidraw/excalidraw/blob/7f66e1fe897873713ba04410534be2d97b9139af/packages/excalidraw/data/encryption.ts#L17
export const generateEncryptionKey = async <
    T extends 'string' | 'cryptoKey' = 'string',
>(
    returnAs?: T,
): Promise<T extends 'cryptoKey' ? CryptoKey : string> => {
    const key = await window.crypto.subtle.generateKey(
        {
            name: 'AES-GCM',
            length: ENCRYPTION_KEY_BITS,
        },
        true, // extractable
        ['encrypt', 'decrypt'],
    );
    return (
        returnAs === 'cryptoKey'
            ? key
            : (await window.crypto.subtle.exportKey('jwk', key)).k
    ) as T extends 'cryptoKey' ? CryptoKey : string;
};
```

### Encrypt decrypt data {#encrypt-decrypt-data}

First, generate cryptographically secure random numbers:

```ts
export const createIV = () => {
    const arr = new Uint8Array(IV_LENGTH_BYTES);
    return window.crypto.getRandomValues(arr);
};
```

Then use this private key to encrypt the serialized scene data, and upload it from the client to cloud storage such as Firebase or AWS S3:

```ts
// @see https://github.com/excalidraw/excalidraw/blob/7f66e1fe897873713ba04410534be2d97b9139af/excalidraw-app/components/ExportToExcalidrawPlus.tsx#L42
const encryptionKey = (await generateEncryptionKey())!;
const encryptedData = await encryptData(
    // 使用 iv 加密
    encryptionKey,
    serializeAsJSON(elements, appState, files, 'database'), // 序列化数据
);
const blob = new Blob(
    [encryptedData.iv, new Uint8Array(encryptedData.encryptedBuffer)],
    {
        type: MIME_TYPES.binary,
    },
);

// Upload blob to Firebase / AWS S3
```

### Homomorphically Encrypting CRDT {#homomorphically-encrypting-crdt}

[Homomorphically Encrypting CRDTs]

## Multiplayer cursors {#multiplayer-cursors}

-   [Building Figma Multiplayer Cursors]
-   [How to animate multiplayer cursors]

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
[Lesson 14]: /guide/lesson-014#z-index
[Homomorphically Encrypting CRDTs]: https://jakelazaroff.com/words/homomorphically-encrypted-crdts/
[End-to-End Encryption in the Browser]: https://plus.excalidraw.com/blog/end-to-end-encryption
[Building Figma Multiplayer Cursors]: https://mskelton.dev/blog/building-figma-multiplayer-cursors
[How to animate multiplayer cursors]: https://liveblocks.io/blog/how-to-animate-multiplayer-cursors
[List]: https://loro.dev/docs/tutorial/list
[LoroDoc]: https://loro.dev/docs/tutorial/loro_doc
[Exporting and Importing]: https://loro.dev/docs/tutorial/loro_doc#exporting-and-importing
[generateKey]: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/generateKey
[exportKey]: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/exportKey
[AES-GCM]: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt#aes-gcm
[JSON Web Key]: https://developer.mozilla.org/zh-CN/docs/Web/API/SubtleCrypto/importKey#json_web_key
[firestore]: https://firebase.google.com/docs/firestore
