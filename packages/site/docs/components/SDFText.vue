<script setup>
import { Text } from '@infinite-canvas-tutorial/core';
import '@infinite-canvas-tutorial/ui';
import { useTemplateRef, onMounted } from 'vue';
import Stats from 'stats.js';

let canvas;

const stats = new Stats();
stats.showPanel(0);
const $stats = stats.dom;
$stats.style.position = 'absolute';
$stats.style.left = '0px';
$stats.style.top = '0px';

const canvasRef = useTemplateRef('canvas');

onMounted(() => {
  const $canvas = canvasRef.value;

  if (!$canvas) return;

  $canvas.parentElement.appendChild($stats);

  $canvas.addEventListener('ic-ready', (e) => {
    canvas = e.detail;

    const text = new Text({
      x: 50,
      y: 150,
      content: 'Hello, world! \n你好世界',
      fontSize: 30,
      fill: '#F67676',
      wireframe: true,
      // textAlign: 'right',
    });
    canvas.appendChild(text);

    const text2 = new Text({
      x: 450,
      y: 150,
      content: 'Hello, world! \n你好世界',
      fontSize: 30,
      fill: '#F67676',
      textAlign: 'center',
    });
    canvas.appendChild(text2);
  });

  $canvas.addEventListener('ic-frame', (e) => {
    stats.update();
  });
});
</script>

<template>
  <div style="position: relative">
    <ic-canvas ref="canvas"></ic-canvas>
  </div>
</template>
