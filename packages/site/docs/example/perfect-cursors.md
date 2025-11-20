---
publish: false
---

<script setup>
import PerfectCursors from '../components/PerfectCursors.vue'
</script>

基于 [liveblocks] 和 Yjs 实现一个更实际的，基于服务端实时协同的例子。

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

可以在多个浏览器窗口中打开这个示例

<PerfectCursors />

[liveblocks]: https://liveblocks.io/multiplayer-editing
