<script setup>
import { Circle } from '@infinite-canvas-tutorial/core';
import '@infinite-canvas-tutorial/ui';
import { onMounted } from 'vue';
import Stats from 'stats.js';

let canvas;

const stats = new Stats();
stats.showPanel(0);
const $stats = stats.dom;
$stats.style.position = 'absolute';
$stats.style.left = '0px';
$stats.style.top = '0px';

onMounted(() => {
  const $canvas = document.querySelector('ic-canvas');

  $canvas.parentElement.appendChild($stats);

  $canvas.addEventListener('ic-ready', (e) => {
    canvas = e.detail;
    const circle = new Circle({
      cx: 100,
      cy: 100,
      r: 50,
      fill: 'red',
    });
    canvas.appendChild(circle);
  });

  $canvas.addEventListener('ic-frame', (e) => {
    stats.update();
  });
});
</script>

<template>
  <div style="position: relative">
    <ic-canvas></ic-canvas>
  </div>
</template>
