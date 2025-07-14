<script setup>
import { Circle, Group } from '@infinite-canvas-tutorial/core';
import { ref, onMounted } from 'vue';

let canvas;
let stats;
let solarSystem;
let earthOrbit;

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

    solarSystem = new Group();
    earthOrbit = new Group();
    const moonOrbit = new Group();

    const sun = new Circle({
      cx: 0,
      cy: 0,
      r: 100,
      fill: 'red',
    });
    const earth = new Circle({
      cx: 0,
      cy: 0,
      r: 50,
      fill: 'blue',
    });
    const moon = new Circle({
      cx: 0,
      cy: 0,
      r: 25,
      fill: 'yellow',
    });
    solarSystem.appendChild(sun);
    solarSystem.appendChild(earthOrbit);
    earthOrbit.appendChild(earth);
    earthOrbit.appendChild(moonOrbit);
    moonOrbit.appendChild(moon);

    solarSystem.position.x = 300;
    solarSystem.position.y = 300;
    earthOrbit.position.x = 100;
    moonOrbit.position.x = 100;

    canvas.appendChild(solarSystem);
  });
  $canvas.addEventListener('ic-frame', (e) => {
    solarSystem.rotation += 0.01;
    earthOrbit.rotation += 0.02;

    stats?.update();
  });
});
</script>

<template>
  <div style="position: relative">
    <ic-canvas ref="wrapper" style="height: 400px"></ic-canvas>
  </div>
</template>
