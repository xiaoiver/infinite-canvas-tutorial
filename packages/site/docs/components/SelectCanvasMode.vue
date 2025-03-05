<script setup>
import { RoughEllipse } from '@infinite-canvas-tutorial/core';
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

onMounted(() => {
  import('@infinite-canvas-tutorial/ui');

  const $canvas = wrapper.value;

  if (!$canvas) return;

  $canvas.parentElement.appendChild($stats);

  $canvas.addEventListener('ic-ready', (e) => {
    canvas = e.detail;

    const ellipse = new RoughEllipse({
      cx: 200,
      cy: 100,
      rx: 50,
      ry: 50,
      fill: 'black',
      strokeWidth: 2,
      stroke: 'red',
      fillStyle: 'zigzag',
    });
    canvas.appendChild(ellipse);
    canvas.render();
    
    canvas.selectShape(ellipse);
  });

  $canvas.addEventListener('ic-frame', (e) => {
    stats.update();
  });
});
</script>

<template>
  <div style="position: relative">
    <ic-canvas ref="wrapper" mode="select" style="height: 400px;"></ic-canvas>
  </div>
</template>
