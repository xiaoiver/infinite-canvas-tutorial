<script setup>
import { Rect } from '@infinite-canvas-tutorial/core';
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

    const image = await load('https://gw.alipayobjects.com/mdn/rms_6ae20b/afts/img/A*jgjxQ57sACsAAAAAAAAAAAAAARQnAQ', ImageLoader);

    const rect = new Rect({
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      fill: {
        image,
        repetition: 'repeat',
      },
    });
    canvas.appendChild(rect);
  });

  $canvas.addEventListener('ic-frame', (e) => {
    stats.update();
  });
});
</script>

<template>
  <div style="position: relative">
    <ic-canvas ref="wrapper" style="height: 400px"></ic-canvas>
  </div>
</template>
