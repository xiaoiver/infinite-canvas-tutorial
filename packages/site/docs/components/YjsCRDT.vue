<script setup lang="ts">
/**
 * @see https://github.com/yjs/yjs
 */
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
import * as Y from 'yjs';
import deepEqual from "deep-equal";

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

let channel: BroadcastChannel;
let doc: Y.Doc;
let yArray: Y.Array<Y.Map<any>>;
const wrapper = ref<HTMLElement | null>(null);
let api: API;
let onReady: ((api: CustomEvent<any>) => void) | undefined;

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  channel = new BroadcastChannel('yjs-crdt');
  channel.onmessage = (e) => {
    const update = new Uint8Array(e.data);
    try {
      Y.applyUpdate(doc, update);
    } catch (e) {
      console.error('Failed to apply update:', e);
    }
  };

  doc = new Y.Doc();
  yArray = doc.getArray("nodes");

  // 从 localStorage 加载保存的状态
  // const savedState = localStorage.getItem("yjs-store");
  // if (savedState) {
  //   try {
  //     const update = Uint8Array.from(atob(savedState), c => c.charCodeAt(0));
  //     Y.applyUpdate(doc, update);
  //   } catch (e) {
  //     console.error('Failed to load saved state:', e);
  //   }
  // }

  // 监听文档更新
  doc.on('update', (update: Uint8Array, origin) => {
    // 如果是本地更新，通过 BroadcastChannel 发送给其他标签页
    if (origin === local) {
      channel.postMessage(update);
    }

    // 保存到 localStorage
    // const base64 = btoa(String.fromCharCode(...update));
    // localStorage.setItem("yjs-store", base64);

    // 如果是远程更新，更新 canvas 节点
    if (origin !== local) {
      const nodes = yArray.toArray().map((map: Y.Map<any>) => map.toJSON());
      api.updateNodes(nodes);
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

    api.updateNodes([node]);
    api.record();
  };
  canvas.addEventListener(Event.READY, onReady);

  // App only runs once
  if (!(window as any).worldInited) {
    (window as any).worldInited = true;
    await import('@infinite-canvas-tutorial/webcomponents/spectrum');
    new App().addPlugins(...DefaultPlugins, UIPlugin).run();
  }
});

onUnmounted(() => {
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
    <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 200px"></ic-spectrum-canvas>
  </div>
</template>
