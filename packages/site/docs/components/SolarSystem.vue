<script setup>
import { Group, Circle } from '@infinite-canvas-tutorial/lesson7';
import { onMounted } from 'vue';

onMounted(() => {
  const $canvas = document.querySelector('ic-canvas-lesson7');

  let solarSystem;
  let earthOrbit;
  $canvas.addEventListener('ic-ready', (e) => {
    const canvas = e.detail;

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
  });
});
</script>

<template>
  <ic-canvas-lesson7></ic-canvas-lesson7>
</template>
