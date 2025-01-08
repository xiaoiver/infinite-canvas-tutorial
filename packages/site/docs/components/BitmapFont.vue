<script setup>
import { Text, loadBitmapFont } from '@infinite-canvas-tutorial/core';
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

  $canvas.addEventListener('ic-ready', async (e) => {
    canvas = e.detail;

    const res = await window.fetch('/desyrel.xml');
    const font = await loadBitmapFont.parse(await res.text());
    const text = new Text({
      x: 50,
      y: 50,
      content: 'Hello, world',
      fontSize: 48,
      fill: '#F67676',
      fontFamily: 'Desyrel',
      bitmapFont: font,
      // wireframe: true,
      // textAlign: 'right',
      // letterSpacing: 10,
    });
    canvas.appendChild(text);
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
