---
publish: false
---

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
