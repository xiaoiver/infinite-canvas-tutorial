<script setup>
/**
 * @see https://github.com/loro-dev/loro-excalidraw
 */

import { Text } from '@infinite-canvas-tutorial/core';
import { ref, onMounted, onUnmounted } from 'vue';
import Stats from 'stats.js';

let canvas;
let channel;
let doc;
let tree;
let lastVersion;

const stats = new Stats();
stats.showPanel(0);
const $stats = stats.dom;
$stats.style.position = 'absolute';
$stats.style.left = '0px';
$stats.style.top = '0px';

const wrapper = ref(null);

onMounted(() => {
  import('@infinite-canvas-tutorial/ui');

  const $canvas = wrapper.value;

  if (!$canvas) return;

  import('loro-crdt').then(({ LoroDoc }) => {
    doc = new LoroDoc();
    tree = doc.getTree("scene-graph");

    console.log(doc, tree);
  });

  // doc = new LoroDoc();
  // tree = doc.getTree("scene-graph");

  // let root = tree.createNode();

  // doc.subscribe((e) => {
  //   const version = Object.fromEntries(doc.version().toJSON());
  //   let vv = "";
  //   for (const [k, v] of Object.entries(version)) {
  //     vv += `${k.toString().slice(0, 4)}:${v} `;
  //   }

  //   if (e.by === "local") {
  //     const bytes = doc.export({ mode: "update", from: lastVersion });
  //     lastVersion = doc.version();
  //     channel.postMessage(bytes);
  //   }

  //   if (e.by !== "local") {
  //     canvas.updateScene({ elements: docElements.toJSON() });
  //   }
  // });

  // channel = new BroadcastChannel("loro-crdt");
  // channel.onmessage = (e) => {
  //   const bytes = new Uint8Array(e.data);
  //   try {
  //     doc.import(bytes);
  //   } catch (e) {
  //     localStorage.clear();
  //     location.reload();
  //   }
  // };

  $canvas.parentElement.appendChild($stats);
  $canvas.addEventListener('ic-ready', (e) => {
    canvas = e.detail;
  });
  $canvas.addEventListener('ic-frame', (e) => {
    stats.update();
  });
});

// onUnmounted(() => {
//   channel.close();
// });
</script>

<template>
  <div style="position: relative">
    <ic-canvas ref="wrapper" style="height: 200px"></ic-canvas>
  </div>
</template>
