<script setup>
import { Rect } from '@infinite-canvas-tutorial/core';
import { Format, TextureUsage } from '@antv/g-device-api';
import { ref, onMounted } from 'vue';

function generateColorRamp(colorRamp) {
  let canvas = window.document.createElement('canvas');
  let ctx = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 1;

  const gradient = ctx.createLinearGradient(0, 0, 256, 0);

  const min = colorRamp.positions[0];
  const max = colorRamp.positions[colorRamp.positions.length - 1];
  for (let i = 0; i < colorRamp.colors.length; ++i) {
    const value = (colorRamp.positions[i] - min) / (max - min);
    gradient.addColorStop(value, colorRamp.colors[i]);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 1);
  return { data: canvas, width: 256, height: 1 };
}

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

    const ramp = generateColorRamp({
      colors: [
        '#FF4818',
        '#F7B74A',
        '#FFF598',
        '#91EABC',
        '#2EA9A1',
        '#206C7C',
      ].reverse(),
      positions: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
    });

    const device = canvas.getDevice();
    const texture = device.createTexture({
      format: Format.U8_RGBA_NORM,
      width: ramp.width,
      height: ramp.height,
      usage: TextureUsage.SAMPLED,
    });
    texture.setImageData([ramp.data]);

    const rect = new Rect({
      x: 150,
      y: 50,
      width: 100,
      height: 100,
      fill: { texture },
    });
    canvas.appendChild(rect);
  });

  $canvas.addEventListener('ic-frame', (e) => {
    stats?.update();
  });
});
</script>

<template>
  <div style="position: relative">
    <ic-canvas ref="wrapper" style="height: 200px"></ic-canvas>
  </div>
</template>
