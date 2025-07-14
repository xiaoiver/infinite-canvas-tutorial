<script setup>
import { Rect } from '@infinite-canvas-tutorial/core';
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

    const rect = new Rect({
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      fill: 'linear-gradient(to right, red, blue)',
    });
    canvas.appendChild(rect);

    const rect2 = new Rect({
      x: 250,
      y: 100,
      width: 100,
      height: 100,
      fill: 'radial-gradient(circle at center, red, blue, green 100%)',
    });
    canvas.appendChild(rect2);

    const rect3 = new Rect({
      x: 400,
      y: 100,
      width: 200,
      height: 100,
      fill: `linear-gradient(217deg, rgba(255,0,0,.8), rgba(255,0,0,0) 70.71%),
              linear-gradient(127deg, rgba(0,255,0,.8), rgba(0,255,0,0) 70.71%),
              linear-gradient(336deg, rgba(0,0,255,.8), rgba(0,0,255,0) 70.71%)`,
    });
    canvas.appendChild(rect3);

    const rect4 = new Rect({
      x: 100,
      y: 250,
      width: 100,
      height: 100,
      fill: 'conic-gradient(#eee, black, #eee)',
    });
    canvas.appendChild(rect4);
  });

  $canvas.addEventListener('ic-frame', (e) => {
    stats?.update();
  });
});
</script>

<template>
  <div style="position: relative">
    <ic-canvas ref="wrapper" style="height: 400px"></ic-canvas>
  </div>
</template>
