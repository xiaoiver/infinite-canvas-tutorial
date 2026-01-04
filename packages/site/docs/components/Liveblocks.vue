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
import { Event, UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { LaserPointerPlugin } from '@infinite-canvas-tutorial/laser-pointer';
import { LassoPlugin } from '@infinite-canvas-tutorial/lasso';
import { EraserPlugin } from '@infinite-canvas-tutorial/eraser';

import * as Y from 'yjs';
import deepEqual from "deep-equal";

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

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  const client = createClient({
    publicApiKey: 'pk_dev_MYcFNShiwPwRDvuvhklopMg6SAkdASzz6QrOMQIlu86NkcuXVNxP06aXrxi9qo7M',
  });
  const { room, leave } = client.enterRoom('my-room-id', {});
  room.subscribe("others", (others) => {
    console.log(`There are ${others.length} other user(s) online`);
  });
  leaveRoom = leave;

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

    const node = {
      type: 'rect',
      id: '0',
      fill: 'red',
      stroke: 'black',
      x: 100,
      y: 100,
      width: 100,
      height: 100,
    } as SerializedNode;

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
    await import('@infinite-canvas-tutorial/lasso/spectrum');
    await import('@infinite-canvas-tutorial/eraser/spectrum');
    await import('@infinite-canvas-tutorial/laser-pointer/spectrum');
    new App().addPlugins(...DefaultPlugins, UIPlugin, LaserPointerPlugin, LassoPlugin, EraserPlugin).run();
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

  api?.destroy();
  yProvider?.destroy();
  doc?.destroy();
});
</script>

<template>
  <div>
    <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 400px"></ic-spectrum-canvas>
  </div>
</template>
