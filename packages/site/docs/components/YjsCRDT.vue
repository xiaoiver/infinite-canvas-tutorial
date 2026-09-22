<script setup lang="ts">
/**
 * @see https://github.com/yjs/yjs
 */
import { App, Pen, DefaultPlugins, API } from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { Event, UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { LaserPointerPlugin } from '@infinite-canvas-tutorial/laser-pointer';
import { LassoPlugin } from '@infinite-canvas-tutorial/lasso';
import { EraserPlugin } from '@infinite-canvas-tutorial/eraser';

import * as Y from 'yjs';
import { bindDocument } from '../collaboration/document';
import { yjsDocument, createYjsDemoDocument } from '../collaboration/yjs';

let unbindDocument: (() => void) | undefined;

let channel: BroadcastChannel;
let doc: Y.Doc;
const wrapper = ref<HTMLElement | null>(null);
let api: API;
let onReady: ((api: CustomEvent<any>) => void) | undefined;

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  channel = new BroadcastChannel('yjs-crdt-v2');
  channel.onmessage = (e) => {
    if (e.data.type === 'sync-request') {
      channel.postMessage({
        type: 'update',
        update: Y.encodeStateAsUpdate(doc),
      });
    } else if (e.data.type === 'update') {
      Y.applyUpdate(doc, e.data.update, channel);
    }
  };

  doc = createYjsDemoDocument();

  doc.on('update', (update: Uint8Array, origin) => {
    if (origin !== channel) channel.postMessage({ type: 'update', update });
  });
  channel.postMessage({ type: 'sync-request' });

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
  channel?.close();
  const canvas = wrapper.value;

  if (!canvas) {
    return;
  }

  if (onReady) {
    canvas.removeEventListener(Event.READY, onReady);
  }

  api?.destroy();
  doc?.destroy();
});
</script>

<template>
  <div>
    <ic-spectrum-canvas
      ref="wrapper"
      style="width: 100%; height: 200px"
    ></ic-spectrum-canvas>
  </div>
</template>
