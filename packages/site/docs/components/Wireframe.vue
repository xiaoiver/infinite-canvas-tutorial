<script setup>
import { Circle, Ellipse, Rect, Polyline, Path } from '@infinite-canvas-tutorial/core';
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

  $canvas.addEventListener('ic-ready', (e) => {
    canvas = e.detail;

    const circle = new Circle({
      cx: 100,
      cy: 100,
      r: 50,
      fill: '#F67676',
      wireframe: true,
    });
    canvas.appendChild(circle);

    const ellipse = new Ellipse({
      cx: 250,
      cy: 100,
      rx: 60,
      ry: 20,
      fill: '#F67676',
      wireframe: true,
    });
    canvas.appendChild(ellipse);

    const rect = new Rect({
      x: 100,
      y: 200,
      width: 100,
      height: 100,
      fill: '#F67676',
      dropShadowBlurRadius: 10,
      dropShadowColor: 'rgba(0, 0, 0, 0.5)',
      dropShadowOffsetX: 10,
      dropShadowOffsetY: 10,
      wireframe: true,
    });
    canvas.appendChild(rect);

    const polyline = new Polyline({
      points: [
        [200, 150],
        [300, 250],
        [400, 150],
        [500, 250],
      ],
      stroke: '#c0c0c0',
      strokeWidth: 20,
      strokeLinecap: 'round',
      strokeLinejoin: 'bevel',
      wireframe: true,
    });
    canvas.appendChild(polyline);

    const path = new Path({
      d: 'M 100 100 L 200 200 L 300 100 Z',
      fill: '#F67676',
      stroke: 'none',
      strokeWidth: 0,
      wireframe: true,
    });
    canvas.appendChild(path);
    path.position.x = 320;
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
