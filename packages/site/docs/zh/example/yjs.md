---
publish: false
---

<script setup>
import YjsCRDT from '../../components/YjsCRDT.vue'
</script>

使用 [Yjs] 和 [BroadcastChannel] 模拟协同场景。

<div style="display:flex;flex-direction:row;">
<div style="flex: 1;">
<YjsCRDT />
</div>
<div style="flex: 1;">
<YjsCRDT />
</div>
</div>

首先监听本地画布变化，将图形列表及其属性对象同步到本地的 `Y.Doc` 中：

```ts
api.onchange = (snapshot) => {
    const { appState, nodes } = snapshot;
    doc.transact(() => {
        // 写入 Y.Doc
    }, local);
};
```

然后监听 `Y.Doc` 的变更，通过 `origin` 区分变更来自本地还是远端。如果来自本地则发送同步消息；如果来自远端则更新画布内容。

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
