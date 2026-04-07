---
title: "Smoothed remote cursors"
description: "Interpolate collaborator pointer streams for stable visuals."
---
<!-- example-intro:en -->

# Smoothed remote cursors

**Perfect-cursors** (or similar easing) reduces jitter when rendering peers’ pointers—important for perceived quality in multiplayer whiteboards.

Pair with Liveblocks/Yjs presence channels.

## Interactive demo

<script setup>
import PerfectCursors from '../components/PerfectCursors.vue'
</script>

Use [liveblocks] Yjs and [perfect-cursors] implementing multiplayer cursors.

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
