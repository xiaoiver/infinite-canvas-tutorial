---
title: "平滑的远程光标"
description: "对协作者指针流插值，减轻抖动。"
---
<!-- example-intro:zh -->

# 平滑的远程光标

对远程光标做 **平滑**（如 perfect-cursors）可显著提升多人白板观感，建议与 Liveblocks/Yjs 的 presence 通道一起使用。

## 交互示例

<script setup>
import PerfectCursors from '../../components/PerfectCursors.vue'
</script>

基于 [liveblocks] Yjs 和 [perfect-cursors] 实现多人光标。

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
<PerfectCursors />
</div>
<div style="flex: 1;">
<PerfectCursors />
</div>
</div>

[liveblocks]: https://liveblocks.io/multiplayer-editing
[perfect-cursors]: https://github.com/steveruizok/perfect-cursors
