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

function convertSceneGraphToLoroTree(node: SerializedNode, doc: LoroDoc) {
  const tree = doc.getTree("scene-graph");

  const loroNode = tree.createNode();
  loroNode.data.set('data', node);

  // const traverse = (node: SerializedNode, loroNode: LoroTreeNode) => {
  //   const loroChildNode = loroNode.createNode();

  //   loroChildNode.data.set('uid', node.uid);
  //   loroChildNode.data.set('type', node.type);
  //   loroChildNode.data.set('attributes', node.attributes);

  //   node.children?.forEach((child) => {
  //     traverse(child, loroChildNode);
  //   });
  // };

  // traverse(serializeNode(sceenGraph), tree.createNode());  

  return tree;
}

function recordLocalOps(
  loroList: LoroList,
  elements: readonly { version?: number; isDeleted?: boolean }[],
): boolean {
  elements = elements.filter((e) => !e.isDeleted);
  let changed = false;
  for (let i = loroList.length; i < elements.length; i++) {
    loroList.insertContainer(i, new LoroMap());
    changed = true;
  }
  if (elements.length < loroList.length) {
    loroList.delete(elements.length, loroList.length - elements.length);
    changed = true;
  }

  const n = elements.length;
  for (let i = 0; i < n; i++) {
    const map = loroList.get(i) as LoroMap | undefined;
    if (!map) {
      break;
    }

    const elem = elements[i];
    if (map.get("version") === elem.version) {
      continue;
    }

    for (const [key, value] of Object.entries(elem)) {
      const src = map.get(key);
      if (
        (typeof src === "object" && !deepEqual(map.get(key), value)) ||
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
  const docElements = doc.getList("elements");
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


      // console.log(docElements.toJSON());

      api.updateNode(docElements.toJSON()[0]);
    }
  });

  onReady = (e) => {
    api = e.detail;
    // api.onchange = (snapshot) => {
    //   const { appState } = snapshot;

    //   const elements = Array.from(snapshot.elements.values());

    //   const v = getVersion(elements);

    //   // if (lastVersion === v) {
    //   // local change, should detect and record the diff to loro doc
    //   if (recordLocalOps(docElements, elements)) {
    //     doc.commit();
    //   }
    //   // }

    //   // lastVersion = v;
    // }

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

    api.setPen(Pen.SELECT);
    api.setTaskbars([Task.SHOW_LAYERS_PANEL]);

    api.updateNodes([node]);
    api.record();

    convertSceneGraphToLoroTree(node, doc);
    console.log(doc.toJSON());
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
