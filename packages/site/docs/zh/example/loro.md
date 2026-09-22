---
title: "使用 Loro CRDT 协同"
description: "用 Loro 的 CRDT 数据结构同步文档状态。"
---
<!-- example-intro:zh -->

# 使用 Loro CRDT 协同

**Loro** 提供多种 CRDT 类型，可与旁边的 Yjs 示例对照；冲突虽自动合并，UI 仍需收敛到合理视图。

架构背景见 [第 20 课 — 协同](/zh/guide/lesson-020)。

## 交互示例

<script setup>
import LoroCRDT from '../../components/LoroCRDT.vue'
</script>

参考 [Loro Excalidraw Example]，使用 [LoroDoc] 和 BroadcastChannel 模拟协同场景：

<div style="display:flex;flex-direction:row;">
<div style="flex: 1;">
<LoroCRDT />
</div>
<div style="flex: 1;">
<LoroCRDT />
</div>
</div>

首先监听本地画布变化，将图形列表及其属性对象同步到本地的 [LoroDoc] 中：

```ts
api.onchange = (snapshot) => {
    const { appState, nodes } = snapshot;
    if (recordLocalOps(docNodes, nodes)) {
        doc.commit();
    }
};
```

然后监听 `LoroDoc` 的变更，通过 `e.by` 区分变更来自本地还是远端。如果来自本地则发送同步消息；如果来自远端则更新画布内容。

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
