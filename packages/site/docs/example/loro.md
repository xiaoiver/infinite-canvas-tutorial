---
publish: false
---

<script setup>
import LoroCRDT from '../components/LoroCRDT.vue'
</script>

Use [LoroDoc] and BroadcastChannel mock collaboration, see [Loro Excalidraw Example].

<div style="display:flex;flex-direction:row;">
<div style="flex: 1;">
<LoroCRDT />
</div>
<div style="flex: 1;">
<LoroCRDT />
</div>
</div>

First, monitor changes to the local canvas and synchronize the list of shapes and their property objects to the local [LoroDoc]:

```ts
api.onchange = (snapshot) => {
    const { appState, nodes } = snapshot;
    if (recordLocalOps(docNodes, nodes)) {
        doc.commit();
    }
};
```

Then listen for changes to `LoroDoc`, distinguishing between local and remote changes via `e.by`. If the change originates locally, send a synchronization message; if it comes from the remote, update the canvas content.

```ts
doc.subscribe((e) => {
    if (e.by === 'local') {
        const bytes = doc.export({ mode: 'update', from: lastVersion });
        lastVersion = doc.version();
        channel.postMessage(bytes);
    }

    if (e.by !== 'local') {
        api.updateNodes(docNodes.toJSON());
    }
});
```

[Loro Excalidraw Example]: https://github.com/loro-dev/loro-excalidraw
[LoroDoc]: https://loro.dev/docs/tutorial/loro_doc
