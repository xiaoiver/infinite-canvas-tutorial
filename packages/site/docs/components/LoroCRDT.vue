<script setup lang="ts">
/**
 * @see https://github.com/loro-dev/loro-excalidraw
 */

import { Canvas, Group, Circle, serializeNode, SerializedNode } from '@infinite-canvas-tutorial/core';
import { ref, onMounted, onUnmounted } from 'vue';
import Stats from 'stats.js';
import { LoroDoc, LoroTree, LoroTreeNode } from 'loro-crdt';

function convertSceneGraphToLoroTree(sceenGraph: Group, doc: LoroDoc) {
  const tree = doc.getTree("scene-graph");

  const traverse = (node: SerializedNode, loroNode: LoroTreeNode) => {
    const loroChildNode = loroNode.createNode();

    loroChildNode.data.set('uid', node.uid);
    loroChildNode.data.set('type', node.type);
    loroChildNode.data.set('attributes', node.attributes);

    node.children?.forEach((child) => {
      traverse(child, loroChildNode);
    });
  };

  traverse(serializeNode(sceenGraph), tree.createNode());  

  return tree;
}

let canvas: Canvas;
let channel: BroadcastChannel;
let doc: LoroDoc;
let tree: LoroTree;
let lastVersion: number;

const stats = new Stats();
stats.showPanel(0);
const $stats = stats.dom;
$stats.style.position = 'absolute';
$stats.style.left = '0px';
$stats.style.top = '0px';

const wrapper = ref<HTMLDivElement | null>(null);

onMounted(() => {
  import('@infinite-canvas-tutorial/ui');

  const $canvas = wrapper.value;

  if (!$canvas) return;

  channel = new BroadcastChannel('loro-crdt');
  channel.onmessage = (e) => {
    const bytes = new Uint8Array(e.data);
    try {
      doc.import(bytes);
    } catch (e) {}
  };

  doc = new LoroDoc();

  $canvas.parentElement?.appendChild($stats);
  // @ts-ignore
  $canvas.addEventListener('ic-ready', (e: CustomEvent<Canvas>) => {
    canvas = e.detail;

    const circle = new Circle({
      cx: 100,
      cy: 100,
      r: 50,
      fill: 'red',
    });
    canvas.appendChild(circle);

    convertSceneGraphToLoroTree(canvas.root, doc);

    console.log(doc.toJSON());
  });
  $canvas.addEventListener('ic-frame', () => {
    stats.update();
  });
  $canvas.addEventListener('ic-changed', () => {
    // console.log(doc.export({ mode: 'update' }));
  });
});

onUnmounted(() => {
  channel?.close();
});
</script>

<template>
  <div style="position: relative">
    <ic-canvas ref="wrapper" style="height: 200px"></ic-canvas>
  </div>
</template>
