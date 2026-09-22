<script setup lang="ts">
import { Pen, API } from '@infinite-canvas-tutorial/ecs';
import { ensureExampleWorld } from '../lib/ensure-example-world';
import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import Cursor from './Cursor.vue';
import { Event } from '@infinite-canvas-tutorial/webcomponents';

import * as Y from 'yjs';
import { bindDocument } from '../collaboration/document';
import { yjsDocument } from '../collaboration/yjs';
import { PerfectCursor } from 'perfect-cursors';

import { createClient, type Room } from '@liveblocks/client';
import { getYjsProviderForRoom } from '@liveblocks/yjs';

let unbindDocument: (() => void) | undefined;

let doc: Y.Doc;
let yProvider: ReturnType<typeof getYjsProviderForRoom>;
const wrapper = ref<HTMLElement | null>(null);
let api: API;
let onReady: ((api: CustomEvent<any>) => void) | undefined;
let leaveRoom: () => void;
type Presence = { cursor: { x: number; y: number } | null };
let room: Room<Presence>;
let cursors: Ref<
  Record<
    string,
    {
      pc: PerfectCursor;
      x: number;
      y: number;
    }
  >
> = ref({});
let unsubscribeMyPresence: () => void;
let unsubscribeOthers: () => void;

const __getUsersFromDB__ = async (userIds: string[]) => {
  console.log(userIds);

  return [
    { name: 'Marc', avatar: 'https://example.com/marc.png' },
    { name: 'Nimesh', avatar: 'https://example.com/nimesh.png' },
  ];
};

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  const client = createClient({
    // throttle: 16,
    publicApiKey:
      'pk_dev_MYcFNShiwPwRDvuvhklopMg6SAkdASzz6QrOMQIlu86NkcuXVNxP06aXrxi9qo7M',
    // @see https://liveblocks.io/docs/api-reference/liveblocks-client#createClientResolveUsers
    resolveUsers: async ({ userIds }) => {
      const usersData = await __getUsersFromDB__(userIds);

      return usersData.map((userData) => ({
        name: userData.name,
        avatar: userData.avatar,
      }));
    },
  });
  const { room: roomInstance, leave } = client.enterRoom<Presence>(
    'my-comments-room-id',
    {
      initialPresence: { cursor: null },
    },
  );
  room = roomInstance;
  leaveRoom = leave;

  unsubscribeMyPresence = room.subscribe('my-presence', (newPresence) => {
    // myPresence.value = newPresence;
  });

  unsubscribeOthers = room.subscribe('others', (others) => {
    others.forEach((other) => {
      const { connectionId, presence } = other;
      if (!cursors.value[connectionId]) {
        cursors.value[connectionId] = {
          pc: new PerfectCursor((point: number[]) => {
            cursors.value[connectionId].x = point[0];
            cursors.value[connectionId].y = point[1];
          }),
          x: 0,
          y: 0,
        };
      }

      if (!presence.cursor || !api) {
        return;
      }

      const { pc } = cursors.value[connectionId];
      const { x, y } = api.canvas2Viewport({
        x: presence.cursor.x,
        y: presence.cursor.y,
      });
      pc.addPoint([Math.round(x), Math.round(y)]);
    });
  });

  yProvider = getYjsProviderForRoom(room, {
    useV2Encoding_experimental: true,
  });
  doc = yProvider.getYDoc();

  onReady = (e) => {
    api = e.detail;
    const adapter = yjsDocument(doc);
    unbindDocument = bindDocument(api, adapter);

    api.setAppState({
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT],
      taskbarAll: [],
      taskbarVisible: false,
    });
  };
  canvas.addEventListener(Event.READY, onReady);

  await ensureExampleWorld();
});

onUnmounted(() => {
  unbindDocument?.();
  leaveRoom?.();
  const canvas = wrapper.value;

  if (!canvas) {
    return;
  }

  if (onReady) {
    canvas.removeEventListener(Event.READY, onReady);
  }
  unsubscribeMyPresence?.();
  unsubscribeOthers?.();

  Object.values(cursors.value).forEach(({ pc }) => {
    pc.dispose();
  });

  api?.destroy();
  yProvider?.destroy();
  doc?.destroy();
});

// Update cursor presence to current pointer location
function handlePointerMove(event: PointerEvent) {
  if (!api || !room) return;
  const { x, y } = api.viewport2Canvas({
    x: event.offsetX,
    y: event.offsetY - 56, // topbar's height
  });
  room.updatePresence({
    cursor: {
      x: Math.round(x),
      y: Math.round(y),
    },
  });
}

// When the pointer leaves the page, set cursor presence to null
function handlePointerLeave() {
  if (!room) return;
  room.updatePresence({
    cursor: null,
  });
}

const COLORS = [
  '#E57373',
  '#9575CD',
  '#4FC3F7',
  '#81C784',
  '#FFF176',
  '#FF8A65',
  '#F06292',
  '#7986CB',
];
</script>

<template>
  <div
    style="position: relative; overflow: clip"
    @pointermove="handlePointerMove"
    @pointerleave="handlePointerLeave"
  >
    <ic-spectrum-canvas
      ref="wrapper"
      style="width: 100%; height: 400px"
    ></ic-spectrum-canvas>

    <!-- Iterate through others and show their cursors -->
    <template v-for="[connectionId, { x, y }] in Object.entries(cursors)">
      <Cursor
        :color="COLORS[connectionId % COLORS.length]"
        :x="x"
        :y="y + 56"
        :name="connectionId"
      />
    </template>
  </div>
</template>
