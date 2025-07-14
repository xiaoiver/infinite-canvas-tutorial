<script setup>
import { Text } from '@infinite-canvas-tutorial/core';
import { ref, onMounted } from 'vue';

let canvas;
let stats;

const wrapper = ref(null);

onMounted(() => {
  import('@infinite-canvas-tutorial/ui');
  const $canvas = wrapper.value;

  if (!$canvas) return;

  import('stats.js').then(m => {
    const Stats = m.default;
    stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';
    $canvas.parentElement.appendChild($stats);
  });

  $canvas.addEventListener('ic-ready', (e) => {
    canvas = e.detail;

    const text = new Text({
      x: 50,
      y: 100,
      content: 'Hello, world! \n🌹🌍🌞🌛',
      fontSize: 30,
      fill: '#F67676',
    });
    canvas.appendChild(text);
  });

  $canvas.addEventListener('ic-frame', (e) => {
    stats?.update();
  });
});
</script>

<template>
  <div style="position: relative">
    <ic-canvas ref="wrapper" style="height: 200px"></ic-canvas>
  </div>
</template>
