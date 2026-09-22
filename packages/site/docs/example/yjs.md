---
title: "Real-time collaboration with Yjs"
description: "Mirror canvas snapshots through Y.Doc and providers."
---
<!-- example-intro:en -->

# Real-time collaboration with Yjs

**Yjs** is widely used for shared editing. This sample wires canvas changes into a `Y.Doc` and syncs via **BroadcastChannel** for local demos—production would use WebRTC or a websocket provider.

Deep patterns live in [Lesson 20 — Collaboration](/guide/lesson-020).

## Interactive demo

<script setup>
import YjsCRDT from '../components/YjsCRDT.vue'
</script>

Use [Yjs] and [BroadcastChannel] to simulate collaboration scenarios.

<div style="display:flex;flex-direction:row;">
<div style="flex: 1;">
<YjsCRDT />
</div>
<div style="flex: 1;">
<YjsCRDT />
</div>
</div>

First, monitor changes to the local canvas and synchronize the list of shapes and their property objects to the local `Y.Doc`:

```ts
api.onchange = (snapshot) => {
    const { appState, nodes } = snapshot;
    doc.transact(() => {
        // 写入 Y.Doc
    }, local);
};
```

Then listen for changes to `Y.Doc`, distinguishing between local and remote changes via `origin`. If the change originates locally, send a synchronization message; if it originates remotely, update the canvas content.

```ts
doc.on('update', (update, origin) => {
    if (origin === local) {
        channel.postMessage(update);
    }

    if (origin !== local) {
        const nodes = yArray.toArray().map((node) => node.toJSON());
        api.updateNodes(nodes);
    }
});
```

[Yjs]: https://docs.yjs.dev/
[BroadcastChannel]: https://developer.mozilla.org/zh-CN/docs/Web/API/BroadcastChannel
