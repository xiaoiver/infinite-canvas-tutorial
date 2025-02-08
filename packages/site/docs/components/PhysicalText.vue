<script setup>
import { Text, Rect } from '@infinite-canvas-tutorial/core';
import { ref, onMounted } from 'vue';
import Stats from 'stats.js';
import { load } from '@loaders.gl/core';
import { ImageLoader } from '@loaders.gl/images';

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

    const image1 = await load('/fonts/paper1-diffuse.jpg', ImageLoader);
    const image2 = await load('/fonts/brick-diffuse.jpg', ImageLoader);
    const image3 = await load('/fonts/burlap-diffuse.jpg', ImageLoader);

    const rect1 = new Rect({
      x: 0,
      y: 100,
      width: 200,
      height: 200,
      fill: image1,
    });
    canvas.appendChild(rect1);

    const rect2 = new Rect({
      x: 200,
      y: 100,
      width: 200,
      height: 200,
      fill: image2,
    });
    canvas.appendChild(rect2);

    const rect3 = new Rect({
      x: 400,
      y: 100,
      width: 200,
      height: 200,
      fill: image3,
    });
    canvas.appendChild(rect3);

    const text1 = new Text({
      x: 20,
      y: 220,
      content: 'Hello, world!',
      fontSize: 24,
      fill: '#000',
      opacity: 0.8,
      physical: true,
    });
    canvas.appendChild(text1);

    const text2 = new Text({
      x: 220,
      y: 220,
      content: 'Hello, world!',
      fontSize: 24,
      fill: '#ffd735',
      physical: true,
    });
    canvas.appendChild(text2);

    const text3 = new Text({
      x: 420,
      y: 220,
      content: 'Hello, world!',
      fontSize: 24,
      fill: '#ffd735',
      opacity: 0.6,
      physical: true,
    });
    canvas.appendChild(text3);
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
