---
outline: deep
publish: false
---

# 课程 17 - 协同

## 历史记录 {#history}

[Excalidraw HistoryEntry]

## Local-first {#local-first}

[The past, present, and future of local-first]

[TipTap offline support]

## CRDT {#crdt}

提到协同算法

[Loro Excalidraw Example]
[automerge wasm]

系列教程：

-   [An Interactive Intro to CRDTs]
-   [Building a Collaborative Pixel Art Editor with CRDTs]
-   [Making CRDTs 98% More Efficient]

```ts
interface CRDT<T, S> {
    value: T;
    state: S;
    merge(state: S): void;
}
```

### Y.js

<https://tiptap.dev/docs/collaboration/getting-started/overview#about-yjs>

> As a CRDT, Y.js ensures that the sequence of changes does not impact the final state of the document, similar to how Git operates with commits. This guarantees that all copies of the data remain consistent across different environments.

### 数据结构设计

## 扩展阅读 {#extended-reading}

-   [Movable tree CRDTs and Loro's implementation]
-   [CRDTs: The Hard Parts]
-   [Peritext - A CRDT for Rich-Text Collaboration]
-   [Collaborative Text Editing with Eg-Walker]
-   [Local-first software - You own your data, in spite of the cloud]
-   [I was wrong. CRDTs are the future]
-   [5000x faster CRDTs: An Adventure in Optimization]
-   [TipTap offline support]
-   [An Interactive Intro to CRDTs]
-   [Building a Collaborative Pixel Art Editor with CRDTs]
-   [Making CRDTs 98% More Efficient]

[Movable tree CRDTs and Loro's implementation](https://news.ycombinator.com/item?id=41099901)
[CRDTs: The Hard Parts](https://www.youtube.com/watch?v=x7drE24geUw)
[Peritext - A CRDT for Rich-Text Collaboration](https://www.inkandswitch.com/peritext/)
[Collaborative Text Editing with Eg-Walker](https://www.youtube.com/watch?v=rjbEG7COj7o)
[Local-first software - You own your data, in spite of the cloud](https://www.inkandswitch.com/local-first/)
[I was wrong. CRDTs are the future](https://josephg.com/blog/crdts-are-the-future/)
[5000x faster CRDTs: An Adventure in Optimization](https://josephg.com/blog/crdts-go-brrr/)
[Loro Excalidraw Example](https://github.com/loro-dev/loro-excalidraw)
[Excalidraw HistoryEntry](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/history.ts#L160-L164)
[automerge wasm](https://automerge.org/blog/2024/08/23/wasm-packaging/)
[The past, present, and future of local-first](https://speakerdeck.com/ept/the-past-present-and-future-of-local-first)
[TipTap offline support]: <https://tiptap.dev/docs/guides/offline-support>
[An Interactive Intro to CRDTs]: <https://jakelazaroff.com/words/an-interactive-intro-to-crdts/>
[Building a Collaborative Pixel Art Editor with CRDTs]: <https://jakelazaroff.com/words/building-a-collaborative-pixel-art-editor-with-crdts/>
[Making CRDTs 98% More Efficient]: <https://jakelazaroff.com/words/making-crdts-98-percent-more-efficient/>
