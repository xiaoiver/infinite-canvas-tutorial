<script setup>
import { Group, deserializeNode, fromSVGElement, TesselationMethod } from '@infinite-canvas-tutorial/core';
import { ref, onMounted } from 'vue';
import Stats from 'stats.js';

let canvas;

const stats = new Stats();
stats.showPanel(0);
const $stats = stats.dom;
$stats.style.position = 'absolute';
$stats.style.left = '0px';
$stats.style.top = '0px';

const wrapper = ref(null);

const renderSVG = async (svg, x, y) => {
  const $container = document.createElement('div');
  $container.innerHTML = svg;
  const $svg = $container.children[0];
  
  const root = new Group();
  for (const child of $svg.children) {
    const group = await deserializeNode(fromSVGElement(child));
    group.children.forEach((path) => {
        path.tessellationMethod = TesselationMethod.LIBTESS;
        path.cullable = false;
    });
   
    root.appendChild(group);
  }

  canvas.appendChild(root);

  root.position.x = x;
  root.position.y = y;
};

onMounted(() => {
  import('@infinite-canvas-tutorial/ui');
  const $canvas = wrapper.value;
  if (!$canvas) {
    return;
  }

  $canvas.addEventListener('ic-ready', (e) => {
    canvas = e.detail;

    window.fetch(
        '/Ghostscript_Tiger.svg',
    ).then(async (res) => {
        const svg = await res.text();
        renderSVG(svg, 80, 80);
    });
  });

  $canvas.addEventListener('ic-frame', (e) => {
    stats.update();
  });
});
</script>

<template>
  <div style="position: relative">
      <ic-canvas ref="wrapper" style="height: 200px"></ic-canvas>
  </div>
</template>