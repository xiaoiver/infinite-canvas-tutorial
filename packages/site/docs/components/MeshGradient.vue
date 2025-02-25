<script setup>
import { Rect } from '@infinite-canvas-tutorial/core';
import { Format, TextureUsage } from '@antv/g-device-api';
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

  $canvas.addEventListener('ic-ready', (e) => {
    canvas = e.detail;

    const device = canvas.getDevice();
    // const texture = device.createTexture({
    //   format: Format.U8_RGBA_NORM,
    //   width: ramp.width,
    //   height: ramp.height,
    //   usage: TextureUsage.SAMPLED,
    // });
    // texture.setImageData([ramp.data]);

    const rect = new Rect({
      x: 150,
      y: 50,
      width: 100,
      height: 100,
      fill: 'hsl(214.82,100%,50%)'
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
