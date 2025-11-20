---
publish: false
---

<script setup>
import Liveblocks from '../components/Liveblocks.vue'
</script>

We will implement a more practical example with [liveblocks] and Yjs.

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

You can open this example in multiple browser windows.

<div style="display:flex;flex-direction:row;">
<div style="flex: 1;">
<Liveblocks />
</div>
<div style="flex: 1;">
<Liveblocks />
</div>
</div>

[liveblocks]: https://liveblocks.io/multiplayer-editing
