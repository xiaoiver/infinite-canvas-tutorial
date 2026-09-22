<script setup lang="ts">
/**
 * @see https://github.com/loro-dev/loro-excalidraw
 */
import { App, Pen, DefaultPlugins, API } from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { Event, UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { LaserPointerPlugin } from '@infinite-canvas-tutorial/laser-pointer';
import { LassoPlugin } from '@infinite-canvas-tutorial/lasso';
import { EraserPlugin } from '@infinite-canvas-tutorial/eraser';

import { LoroDoc } from 'loro-crdt';
import { bindDocument } from '../collaboration/document';
import { loroDocument, createLoroDemoDocument } from '../collaboration/loro';

let channel: BroadcastChannel;
let doc: LoroDoc;
let unbindDocument: (() => void) | undefined;
let unsubscribe: (() => void) | undefined;
const wrapper = ref<HTMLElement | null>(null);
let api: API;
let onReady: ((api: CustomEvent<any>) => void) | undefined;

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  doc = createLoroDemoDocument();
  const saved = localStorage.getItem('loro-canvas-v2');
  if (saved) {
    try {
      doc.import(Uint8Array.from(atob(saved), (char) => char.charCodeAt(0)));
    } catch (error) {
      console.error('Failed to restore the Loro document', error);
    }
  }
  channel = new BroadcastChannel('loro-crdt-v2');
  channel.onmessage = (event) => {
    if (event.data.type === 'sync-request') {
      channel.postMessage({
        type: 'update',
        update: doc.export({ mode: 'snapshot' }),
      });
    } else if (event.data.type === 'update') {
      doc.import(event.data.update);
    }
  };
  unsubscribe = doc.subscribe((event) => {
    const update = doc.export({ mode: 'snapshot' });
    if (event.by === 'local') channel.postMessage({ type: 'update', update });
    let binary = '';
    update.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    localStorage.setItem('loro-canvas-v2', btoa(binary));
  });
  channel.postMessage({ type: 'sync-request' });

  onReady = (e) => {
    api = e.detail;
    const adapter = loroDocument(doc);
    unbindDocument = bindDocument(api, adapter);

    api.setAppState({
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT],
      taskbarAll: [],
      taskbarVisible: false,
      // taskbarSelected: [Task.SHOW_LAYERS_PANEL],
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
  unsubscribe?.();
  channel?.close();
  const canvas = wrapper.value;

  if (!canvas) {
    return;
  }

  if (onReady) {
    canvas.removeEventListener(Event.READY, onReady);
  }

  api?.destroy();
  doc?.free();
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
