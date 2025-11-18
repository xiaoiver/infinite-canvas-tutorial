<script setup lang="ts">
/**
 * @see https://github.com/loro-dev/loro-excalidraw
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
import { LoroDoc, LoroList, LoroMap, OpId, VersionVector } from "loro-crdt";
import deepEqual from "deep-equal";

function recordLocalOps(
  loroList: LoroList,
  nodes: readonly { version?: number; isDeleted?: boolean }[],
): boolean {
  nodes = nodes.filter((e) => !e.isDeleted);
  let changed = false;
  for (let i = loroList.length; i < nodes.length; i++) {
    loroList.insertContainer(i, new LoroMap());
    changed = true;
  }
  if (nodes.length < loroList.length) {
    loroList.delete(nodes.length, loroList.length - nodes.length);
    changed = true;
  }

  const n = nodes.length;
  for (let i = 0; i < n; i++) {
    const map = loroList.get(i) as LoroMap | undefined;
    if (!map) {
      break;
    }

    const elem = nodes[i];
    if (map.get("version") === elem.version) {
      continue;
    }

    for (const [key, value] of Object.entries(elem)) {
      const src = map.get(key);
      if (
        (typeof src === 'object' && !deepEqual(map.get(key), value)) ||
        src !== value
      ) {
        changed = true;
        map.set(key, value);
      }
    }
  }

  return changed;
}

function getVersion(elems: readonly { version?: number }[]): number {
  return elems.reduce((acc, curr) => {
    return (curr.version ?? 0) + acc;
  }, 0);
}

let channel: BroadcastChannel;
let doc: LoroDoc;
let lastVersion: number;
const wrapper = ref<HTMLElement | null>(null);
let api: API;
let onReady: ((api: CustomEvent<any>) => void) | undefined;

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  channel = new BroadcastChannel('loro-crdt');
  channel.onmessage = (e) => {
    const bytes = new Uint8Array(e.data);
    try {
      doc.import(bytes);
    } catch (e) { }
  };

  doc = new LoroDoc();
  const data = localStorage.getItem("store");
  const docNodes = doc.getList("nodes");
  let lastVersion: VersionVector | undefined = undefined;

  doc.subscribe((e) => {
    const version = Object.fromEntries(doc.version().toJSON());
    let vv = "";
    for (const [k, v] of Object.entries(version)) {
      vv += `${k.toString().slice(0, 4)}:${v} `;
    }

    if (e.by === "local") {
      const bytes = doc.export({ mode: "update", from: lastVersion });
      lastVersion = doc.version();
      channel.postMessage(bytes);
    }
    if (e.by !== "checkout") {
      const updates = doc.export({ mode: "update" });
      let str = "";
      for (let i = 0; i < updates.length; i++) {
        str += String.fromCharCode(updates[i]);
      }
      localStorage.setItem("store", btoa(str));
    }

    if (e.by !== "local") {
      api.updateNodes(docNodes.toJSON());
    }
  });

  onReady = (e) => {
    api = e.detail;
    api.onchange = (snapshot) => {
      const { appState, nodes } = snapshot;
      if (recordLocalOps(docNodes, nodes)) {
        doc.commit();
      }
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
      // taskbarSelected: [Task.SHOW_LAYERS_PANEL],
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
});
</script>

<template>
  <div>
    <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 200px"></ic-spectrum-canvas>
  </div>
</template>
