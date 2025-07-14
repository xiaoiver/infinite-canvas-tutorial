<script setup>
import { Path, TesselationMethod } from '@infinite-canvas-tutorial/core';
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

    const path = new Path({
      d: 'M0 0 L100 0 L100 100 L0 100 Z M50 50 L50 75 L75 75 L75 50 Z M25 25 L25 50 L50 50 L50 25 Z',
      fill: '#F67676',
      tesselationMethod: TesselationMethod.EARCUT,
      // tesselationMethod: TesselationMethod.LIBTESS,
    });
    canvas.appendChild(path);
    path.position.x = 100;
    path.position.y = 100;

    const ring = new Path({
      d: 'M 50 10 A 40 40 0 1 0 50 90 A 40 40 0 1 0 50 10 Z M 50 30 A 20 20 0 1 1 50 70 A 20 20 0 1 1 50 30 Z',
      fill: '#F67676',
      // stroke: 'green',
      // strokeWidth: 2,
    });
    canvas.appendChild(ring);
    ring.position.x = 300;
    ring.position.y = 100;
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
