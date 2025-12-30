<script setup lang="ts">
import {
  App,
  Pen,
  DefaultPlugins,
  SerializedNode,
  API,
  Task,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import Cursor from "./Cursor.vue";
import { Event, UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { LaserPointerPlugin } from '@infinite-canvas-tutorial/laser-pointer';

import * as Y from 'yjs';
import deepEqual from "deep-equal";
import { PerfectCursor } from "perfect-cursors";

import { createClient } from '@liveblocks/client';
import { getYjsProviderForRoom } from '@liveblocks/yjs';

const local = Math.random().toString();

function recordLocalOps(
  yArray: Y.Array<Y.Map<any>>,
  nodes: readonly { version?: number; isDeleted?: boolean }[],
): boolean {
  doc.transact(() => {
    nodes = nodes.filter((e) => !e.isDeleted);
    let changed = false;

    // 同步数组长度
    while (yArray.length < nodes.length) {
      const map = new Y.Map();
      yArray.push([map]);
      changed = true;
    }

    while (yArray.length > nodes.length) {
      yArray.delete(yArray.length - 1, 1);
      changed = true;
    }

    // 同步每个节点的属性
    const n = nodes.length;
    for (let i = 0; i < n; i++) {
      const map = yArray.get(i) as Y.Map<any> | undefined;
      if (!map) {
        break;
      }

      const elem = nodes[i];
      const currentVersion = map.get("version");

      if (currentVersion === elem.version) {
        continue;
      }

      // 更新所有属性
      for (const [key, value] of Object.entries(elem)) {
        const src = map.get(key);
        if (
          (typeof src === 'object' && !deepEqual(src, value)) ||
          src !== value
        ) {
          changed = true;
          map.set(key, value);
        }
      }
    }
  }, local);
}

let doc: Y.Doc;
let yProvider: YjsProvider;
let yArray: Y.Array<Y.Map<any>>;
const wrapper = ref<HTMLElement | null>(null);
let api: API;
let onReady: ((api: CustomEvent<any>) => void) | undefined;
let leaveRoom: () => void;
let room: Room;
let myPresence: Ref<Presence> = ref({ cursor: null });
let others: Ref<Presence[]> = ref([]);
let cursors: Ref<Record<string, {
  pc: PerfectCursor,
  x: number,
  y: number,
}>> = ref({});
let unsubscribeMyPresence: () => void;
let unsubscribeOthers: () => void;

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  const client = createClient({
    // throttle: 16,
    publicApiKey: 'pk_dev_MYcFNShiwPwRDvuvhklopMg6SAkdASzz6QrOMQIlu86NkcuXVNxP06aXrxi9qo7M',
  });
  const { room: roomInstance, leave } = client.enterRoom('my-room-id', {
    initialPresence: { cursor: null },
  });
  room = roomInstance;
  leaveRoom = leave;

  unsubscribeMyPresence = room.subscribe("my-presence", (newPresence) => {
    // myPresence.value = newPresence;
  });

  unsubscribeOthers = room.subscribe("others", (others) => {
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

      if (!presence.cursor) {
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
  yArray = doc.getArray("nodes");

  doc.on('update', (update: Uint8Array, origin) => {
    if (origin !== local) {
      const nodes = yArray.toArray().map((map: Y.Map<any>) => map.toJSON());
      api.runAtNextTick(() => {
        api.updateNodes(nodes);
      });
    }
  });

  onReady = (e) => {
    api = e.detail;
    api.onchange = (snapshot) => {
      const { appState, nodes } = snapshot;
      recordLocalOps(yArray, nodes);
    }

    api.setAppState({
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT],
      taskbarAll: [],
      taskbarVisible: false,
    });
  };
  canvas.addEventListener(Event.READY, onReady);

  // App only runs once
  if (!(window as any).worldInited) {
    (window as any).worldInited = true;
    await import('@infinite-canvas-tutorial/webcomponents/spectrum');
    new App().addPlugins(...DefaultPlugins, UIPlugin, LaserPointerPlugin).run();
  }
});

onUnmounted(() => {
  leaveRoom?.();
  const canvas = wrapper.value;

  if (!canvas) {
    return;
  }

  if (onReady) {
    canvas.removeEventListener(Event.READY, onReady);
  }
  unsubscribeMyPresence();
  unsubscribeOthers();

  Object.values(cursors.value).forEach(({ pc }) => {
    pc.dispose();
  });

  api?.destroy();
  yProvider?.destroy();
  doc?.destroy();
});

// Update cursor presence to current pointer location
function handlePointerMove(event: PointerEvent) {
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
  room.updatePresence({
    cursor: null,
  });
}

const COLORS = [
  "#E57373",
  "#9575CD",
  "#4FC3F7",
  "#81C784",
  "#FFF176",
  "#FF8A65",
  "#F06292",
  "#7986CB",
];
</script>

<template>
  <div style="position: relative; overflow: clip;" @pointermove="handlePointerMove" @pointerleave="handlePointerLeave">
    <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 400px"></ic-spectrum-canvas>

    <!-- Iterate through others and show their cursors -->
    <template v-for="[connectionId, { x, y }] in Object.entries(cursors)">
      <Cursor :color="COLORS[connectionId % COLORS.length]" :x="x" :y="y + 56" :name="connectionId" />
    </template>
  </div>
</template>
