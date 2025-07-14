<script setup>
import { Text, Rect, Polyline } from '@infinite-canvas-tutorial/core';
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

    const baseline = new Polyline({
      points: [
        [0, 150],
        [1000, 150],
      ],
      stroke: 'black',
      strokeWidth: 1,
    });
    canvas.appendChild(baseline);

    ['alphabetic', 'middle', 'hanging', 'ideographic', 'bottom', 'top'].forEach(
      (textBaseline, index) => {
        const text = new Text({
          x: 50 + index * 100,
          y: 150,
          content: 'abcd',
          fontSize: 30,
          fill: '#F67676',
          textBaseline,
        });
        canvas.appendChild(text);
        const bounds = text.getBounds();
        const rect = new Rect({
          x: bounds.minX,
          y: bounds.minY,
          width: bounds.maxX - bounds.minX,
          height: bounds.maxY - bounds.minY,
          fill: 'none',
          stroke: 'blue',
          strokeWidth: 1,
        });
        canvas.appendChild(rect);
      });
  });

  $canvas.addEventListener('ic-frame', (e) => {
    stats?.update();
  });
});
</script>

<template>
  <div style="position: relative">
    <ic-canvas ref="wrapper"></ic-canvas>
  </div>
</template>
