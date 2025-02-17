---
outline: deep
publish: false
---

# 课程 17 - 协同

在本课程中，我们将探讨如何实现多人协同编辑功能。我们会介绍几个核心概念和技术，包括历史记录、本地优先（Local-first）以及 CRDT。

## CRDT {#crdt}

什么是 CRDT 呢？下面的介绍来自 [What are CRDTs]，Google Docs / Figma / Tiptap 的协同功能都是基于它实现的，这篇文章还详细对比了 CRDT 和 OT 的特点：

> CRDT (conflict-free replicated data type) is a data structure that can be replicated across multiple computers in a network, where replicas can be updated independently and in parallel, without the need for coordination between replicas, and with a guarantee that no conflicts will occur.

下图来自 [What are CRDTs]，它展示了 CAP 定理下，CRDT 不提供“完美的一致性”，而是最终的一致性。虽然无法保证实时一致，但当两个节点同步消息时，会恢复到一致性状态。

![CRDT satisfies A + P + Eventual Consistency; a good tradeoff under CAP](https://loro.dev/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fa4858e2a50bc1a2d79722060156e89b0cac5815cf25e8c67e409aa0926280cef.6a607785.png&w=3840&q=75)

### CRDT 的两种类型 {#two-types-of-crdts}

CRDT 有两种类型：Op-based 和 State-based。前者的原理是，如果两个用户执行相同的操作序列，则文档的最终状态也应相同。为此，每个用户保存了对数据（操作）执行的所有操作，并将这些操作与其他用户同步，以确保最终状态。而后者需要在节点间传递整个状态。看上去前者需要传递的数据量更少更节省带宽，毕竟只是操作的描述，但这要求前者通过复杂实现保证幂等的操作和处理操作的顺序问题，相对来说后者的实现会更简单。

现在让我们通过下面这个系列教程来了解 State-based CRDT：

-   [An Interactive Intro to CRDTs]
-   [Building a Collaborative Pixel Art Editor with CRDTs]
-   [Making CRDTs 98% More Efficient]

教程给出了一个 CRDT 的通用数据结构，它包括一个必须满足结合律、交换律和幂等性的合并函数。这个合并函数可以是一个 Last-Writer Wins Register，每次对比自身和输入数据的时间戳，如果输入数据的时间戳更大，则更新自身数据：

```ts
interface CRDT<T, S> {
    value: T;
    state: S;
    merge(state: S): void;
}
```

键值对形式的样式表就很适合使用 LWW Register，例如 Quill 编辑器的 `{bold: true}` 样式，详见：[Designing Data Structures for Collaborative Apps]，我们实现的图形样式同理。

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

下面我们参考 [Loro Excalidraw Example] 和 [dgmjs-plugin-yjs] 来实现简单的画布协同编辑效果。

## 历史记录 {#history}

参考 [Excalidraw HistoryEntry]，我们增加一个 History 类，用于管理撤销和重做。

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

## 扩展阅读 {#extended-reading}

-   [How Figma’s multiplayer technology works]
-   [The Full Spectrum of Collaboration]
-   [Learn Yjs]
-   [Movable tree CRDTs and Loro's implementation]
-   [CRDTs: The Hard Parts]
-   [An Interactive Intro to CRDTs]

[What are CRDTs]: https://loro.dev/docs/concepts/crdt
[Movable tree CRDTs and Loro's implementation]: https://news.ycombinator.com/item?id=41099901
[CRDTs: The Hard Parts]: https://www.youtube.com/watch?v=x7drE24geUw
[Peritext - A CRDT for Rich-Text Collaboration]: https://www.inkandswitch.com/peritext/
[Collaborative Text Editing with Eg-Walker]: https://www.youtube.com/watch?v=rjbEG7COj7o
[Local-first software - You own your data, in spite of the cloud]: https://www.inkandswitch.com/local-first/
[I was wrong. CRDTs are the future]: https://josephg.com/blog/crdts-are-the-future/
[5000x faster CRDTs: An Adventure in Optimization]: https://josephg.com/blog/crdts-go-brrr/
[Loro Excalidraw Example]: https://github.com/loro-dev/loro-excalidraw
[Excalidraw HistoryEntry]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/history.ts#L160-L164
[automerge wasm]: https://automerge.org/blog/2024/08/23/wasm-packaging/
[The past, present, and future of local-first]: https://speakerdeck.com/ept/the-past-present-and-future-of-local-first
[TipTap offline support]: https://tiptap.dev/docs/guides/offline-support
[An Interactive Intro to CRDTs]: https://jakelazaroff.com/words/an-interactive-intro-to-crdts/
[Building a Collaborative Pixel Art Editor with CRDTs]: https://jakelazaroff.com/words/building-a-collaborative-pixel-art-editor-with-crdts/
[Making CRDTs 98% More Efficient]: https://jakelazaroff.com/words/making-crdts-98-percent-more-efficient/
[Learn Yjs]: https://learn.yjs.dev/
[dgmjs-plugin-yjs]: https://github.com/dgmjs/dgmjs/tree/main/packages/dgmjs-plugin-yjs
[Designing Data Structures for Collaborative Apps]: https://mattweidner.com/2022/02/10/collaborative-data-design.html
[The Full Spectrum of Collaboration]: https://zed.dev/blog/full-spectrum-of-collaboration
[Collaborative Whiteboard Example in Liveblocks]: https://liveblocks.io/examples/collaborative-whiteboard
[Data Structures in Liveblocks]: https://liveblocks.io/docs/api-reference/liveblocks-client#Data-structures
[Y.Map]: https://docs.yjs.dev/api/shared-types/y.map
[Simple Values]: https://automerge.org/docs/documents/values/
[Map]: https://loro.dev/docs/tutorial/map
[How Figma’s multiplayer technology works]: https://www.figma.com/blog/how-figmas-multiplayer-technology-works/
