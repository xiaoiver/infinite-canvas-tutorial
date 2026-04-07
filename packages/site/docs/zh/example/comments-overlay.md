---
title: "画布上的评论层"
description: "将讨论锚点到坐标，并与多人后端联动。"
---
<!-- example-intro:zh -->

# 画布上的评论层

评论需要 **锚点**、**权限** 与 **通知**，常叠在 CRDT 文档状态之上。本示例用 Liveblocks 展示叠加 UI；鉴权需按租户模型扩展。

审计场景可将评论与几何一并导出。

## 交互示例

<script setup>
import CommentsOverlay from '../../components/CommentsOverlay.vue'
</script>

Use [liveblocks] Yjs implementing comments overlay.

```ts
import { createClient } from '@liveblocks/client';
import { getYjsProviderForRoom } from '@liveblocks/yjs';

const client = createClient({
    throttle: 16,
    publicApiKey: 'pk_dev...',
});
const { room, leave } = client.enterRoom('my-room-id', {
    initialPresence: { cursor: null },
});

const yProvider = getYjsProviderForRoom(room);
const yDoc = yProvider.getYDoc();
```

<div style="display:flex;flex-direction:row;">
<div style="flex: 1;">
<CommentsOverlay />
</div>
<div style="flex: 1;">
<CommentsOverlay />
</div>
</div>

[liveblocks]: https://liveblocks.io/multiplayer-editing
