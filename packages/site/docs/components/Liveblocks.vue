<script setup lang="ts">
import { App, Pen, DefaultPlugins, API } from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { Event, UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { LaserPointerPlugin } from '@infinite-canvas-tutorial/laser-pointer';
import { LassoPlugin } from '@infinite-canvas-tutorial/lasso';
import { EraserPlugin } from '@infinite-canvas-tutorial/eraser';

import * as Y from 'yjs';
import { bindDocument } from '../collaboration/document';
import { yjsDocument } from '../collaboration/yjs';

import { createClient } from '@liveblocks/client';
import { getYjsProviderForRoom } from '@liveblocks/yjs';

let unbindDocument: (() => void) | undefined;

let doc: Y.Doc;
let yProvider: ReturnType<typeof getYjsProviderForRoom>;
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
    publicApiKey:
      'pk_dev_MYcFNShiwPwRDvuvhklopMg6SAkdASzz6QrOMQIlu86NkcuXVNxP06aXrxi9qo7M',
  });
  const { room, leave } = client.enterRoom('my-room-id', {});
  room.subscribe('others', (others) => {
    console.log(`There are ${others.length} other user(s) online`);
  });
  leaveRoom = leave;

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

  // App only runs once
  if (!(window as any).worldInited) {
    (window as any).worldInited = true;
    await import('@infinite-canvas-tutorial/webcomponents/spectrum');
    await import('@infinite-canvas-tutorial/lasso/spectrum');
    await import('@infinite-canvas-tutorial/eraser/spectrum');
    await import('@infinite-canvas-tutorial/laser-pointer/spectrum');
    new App()
      .addPlugins(
        ...DefaultPlugins,
        UIPlugin,
        LaserPointerPlugin,
        LassoPlugin,
        EraserPlugin,
      )
      .run();
  }
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

  api?.destroy();
  yProvider?.destroy();
  doc?.destroy();
});
</script>

<template>
  <div>
    <ic-spectrum-canvas
      ref="wrapper"
      style="width: 100%; height: 400px"
    ></ic-spectrum-canvas>
  </div>
</template>
