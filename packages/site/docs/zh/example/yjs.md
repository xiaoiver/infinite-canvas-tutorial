---
title: "使用 Yjs 实时协同"
description: "通过 Y.Doc 与传输层镜像画布状态。"
---
<!-- example-intro:zh -->

# 使用 Yjs 实时协同

**Yjs** 在协同编辑中应用广泛。本示例用 **BroadcastChannel** 做本地双窗演示，生产环境可换 WebRTC 或 WebSocket Provider。

深入模式见 [第 20 课 — 协同](/zh/guide/lesson-020)。

## 交互示例

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
