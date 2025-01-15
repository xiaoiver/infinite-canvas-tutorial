<script setup>
import { Text, Rect } from '@infinite-canvas-tutorial/core';
import '@infinite-canvas-tutorial/ui';
import { ref, onMounted } from 'vue';
import Stats from 'stats.js';
import WebFont from 'webfontloader';

let canvas;

const stats = new Stats();
stats.showPanel(0);
const $stats = stats.dom;
$stats.style.position = 'absolute';
$stats.style.left = '0px';
$stats.style.top = '0px';

const wrapper = ref(null);

onMounted(() => {
  const $canvas = wrapper.value;

  if (!$canvas) return;

  $canvas.parentElement.appendChild($stats);

  $canvas.addEventListener('ic-ready', async (e) => {
    canvas = e.detail;

    WebFont.load({
      google: {
        families: ['Gaegu'],
      },
      active: () => {
        const text = new Text({
          x: 150,
          y: 150,
          content: 'Hello, world',
          fontFamily: 'Gaegu',
          fontSize: 55,
          fill: '#F67676',
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
      }
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
