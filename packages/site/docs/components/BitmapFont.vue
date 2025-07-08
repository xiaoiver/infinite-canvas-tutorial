<script setup>
import { Text, Rect, loadBitmapFont } from '@infinite-canvas-tutorial/core';
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

  $canvas.addEventListener('ic-ready', async (e) => {
    canvas = e.detail;

    const res = await window.fetch('/fonts/desyrel.xml');
    const font = await loadBitmapFont.parse(await res.text());

    {
      const text = new Text({
        x: 50,
        y: 150,
        content: 'Hello, world',
        fontSize: 55,
        fill: '#F67676',
        fontFamily: 'Desyrel',
        bitmapFont: font,
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

    {
      const text = new Text({
        x: 50,
        y: 250,
        content: 'Hello, world',
        fontSize: 55,
        fill: '#F67676',
        fontFamily: 'Desyrel',
        bitmapFont: font,
        bitmapFontKerning: false,
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

  $canvas.addEventListener('ic-frame', (e) => {
    stats.update();
  });
});
</script>

<template>
  <div style="position: relative">
    <ic-canvas ref="wrapper"></ic-canvas>
  </div>
</template>
