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

    // fill-rule: nonzero
    const star1 = new Path({
      d: 'M50 0 L21 90 L98 35 L2 35 L79 90 Z',
      fill: '#F67676',
      // wireframe: true,
      // tessellationMethod: TesselationMethod.EARCUT,
      tessellationMethod: TesselationMethod.LIBTESS,
    });
    canvas.appendChild(star1);
    star1.position.x = 100;
    star1.position.y = 100;

    // fill-rule: evenodd
    const star2 = new Path({
      d: 'M150 0 L121 90 L198 35 L102 35 L179 90 Z',
      fill: '#F67676',
      fillRule: 'evenodd',
      // wireframe: true,
      tessellationMethod: TesselationMethod.LIBTESS,
      // stroke: 'green',
      // strokeWidth: 2,
    });
    canvas.appendChild(star2);
    star2.position.x = 300;
    star2.position.y = 100;
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
