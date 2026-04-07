---
title: "Liveblocks presence and storage"
description: "Use Liveblocks for rooms, presence, and persisted storage."
---
<!-- example-intro:en -->

# Liveblocks presence and storage

**Liveblocks** bundles presence, storage, and comments for multiplayer products—good when you want managed infrastructure. Compare self-hosted CRDT costs before choosing.

Comments overlay example extends the same stack.

## Interactive demo

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
