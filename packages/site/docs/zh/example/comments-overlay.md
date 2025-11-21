---
publish: false
---

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
