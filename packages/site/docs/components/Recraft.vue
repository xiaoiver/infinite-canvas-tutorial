<script setup>
import { Rect } from '@infinite-canvas-tutorial/core';
import { ref, onMounted } from 'vue';
import Stats from 'stats.js';
import OpenAI from "openai";

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

    // @see https://www.recraft.ai/blog/cartoon-vector-art
    const client = new OpenAI({
      baseUrl: 'https://external.api.recraft.ai/v1',
      dangerouslyAllowBrowser: true
    });

    // const image = await client.images.generate({ 
    //   prompt: "A cute baby sea otter", 
    //   style: "vector_illustration", 
    //   substyle: "digital_illustration",
    // });
    // console.log(image.data[0].url);
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
