---
title: "Liveblocks 在线房间与存储"
description: "使用 Liveblocks 管理房间、在线状态与持久存储。"
---
<!-- example-intro:zh -->

# Liveblocks 在线房间与存储

**Liveblocks** 将在线状态、存储与评论等打包，适合希望使用托管后端的场景；可与自建 CRDT 成本对照。

评论叠加示例基于同一技术栈扩展。

## 交互示例

<script setup>
import Liveblocks from '../../components/Liveblocks.vue'
</script>

基于 [liveblocks] 和 Yjs 实现一个更实际的，基于服务端实时协同的例子。

```ts
import { createClient } from '@liveblocks/client';
import { getYjsProviderForRoom } from '@liveblocks/yjs';

const client = createClient({
    publicApiKey: 'pk_dev...',
});
const { room, leave } = client.enterRoom('my-room-id', {});

const yProvider = getYjsProviderForRoom(room);
const yDoc = yProvider.getYDoc();
```

也可以在多个浏览器窗口中打开这个示例：

<div style="display:flex;flex-direction:row;">
<div style="flex: 1;">
<Liveblocks />
</div>
<div style="flex: 1;">
<Liveblocks />
</div>
</div>

[liveblocks]: https://liveblocks.io/multiplayer-editing
