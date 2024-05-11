<script setup>
import { Circle } from '@infinite-canvas-tutorial/lesson8';
import { onMounted, ref } from 'vue';
import Stats from 'stats.js';

const total = ref(0);
const culled = ref(0);
const circles = [];
let canvas;

const stats = new Stats();
stats.showPanel(0);
const $stats = stats.dom;
$stats.style.position = 'absolute';
$stats.style.left = '0px';
$stats.style.top = '0px';

const add500Circles = () => {
  for (let i = 0; i < 500; i++) {
    const circle = new Circle({
      cx: Math.random() * 1000,
      cy: Math.random() * 1000,
      r: Math.random() * 20,
      fill: `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
        Math.random() * 255,
      )},${Math.floor(Math.random() * 255)})`,
      batchable: true,
    });
    canvas.appendChild(circle);
    circles.push(circle);
  }
};

onMounted(() => {
  const $canvas = document.querySelector('ic-canvas-lesson8');

  $canvas.parentElement.appendChild($stats);

  $canvas.addEventListener('ic-ready', (e) => {
    canvas = e.detail;
    add500Circles();
  });

  $canvas.addEventListener('ic-frame', (e) => {
    stats.update();
    total.value = circles.length;
    culled.value = circles.filter((circle) => circle.culled).length;
  });
});
</script>

<template>
  <span>total: {{ total }}</span>
  &nbsp;
  <span>culled: {{ culled }}</span>
  &nbsp;
  <sl-button size="small" @click="add500Circles">Add 500 circles</sl-button>
  <div style="position: relative">
    <ic-canvas-lesson8></ic-canvas-lesson8>
  </div>
</template>
