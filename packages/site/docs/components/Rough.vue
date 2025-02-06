<script setup>
import { RoughRect } from '@infinite-canvas-tutorial/core';
import { onMounted } from 'vue';
import Stats from 'stats.js';
import GUI from 'lil-gui';

const stats = new Stats();
stats.showPanel(0);
const $stats = stats.dom;
$stats.style.position = 'absolute';
$stats.style.left = '0px';
$stats.style.top = '0px';

onMounted(() => {
  import('@infinite-canvas-tutorial/ui');

  const $canvas = document.querySelector('ic-canvas');
  let canvas;

  $canvas.parentElement.appendChild($stats);

  const rect = new RoughRect({
    x: 100,
    y: 100,
    width: 200,
    height: 200,
    fill: 'red',
    stroke: 'blue',
    bowing: 1,
    roughness: 1,
    fillStyle: 'hachure',
  });

  $canvas.addEventListener('ic-ready', (e) => {
    canvas = e.detail;
    canvas.appendChild(rect);
  });

  $canvas.addEventListener('ic-frame', (e) => {
    stats.update();
  });

  const gui = new GUI({
    container: $canvas.parentElement,
  });
  const config = {
    roughness: 1,
    bowing: 1,
    fillStyle: 'hachure',
  };
  gui.add(config, 'bowing', 0, 5, 0.5).onChange((bowing) => {
    rect.bowing = bowing;
  });
  gui.add(config, 'roughness', 0, 5, 0.5).onChange((roughness) => {
    rect.roughness = roughness;
  });
  gui.add(config, 'fillStyle', [
    'hachure',
    'solid',
    'zigzag',
    'cross-hatch',
    'dots',
    'dashed',
    'zigzag-line',
  ]).onChange((fillStyle) => {
    rect.fillStyle = fillStyle;
  });
});
</script>

<template>
  <ic-canvas></ic-canvas>
</template>
