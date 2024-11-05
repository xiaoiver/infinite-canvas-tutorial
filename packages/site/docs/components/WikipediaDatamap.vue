<script setup>
import { Circle } from '@infinite-canvas-tutorial/core';
import '@infinite-canvas-tutorial/ui';
import { onMounted } from 'vue';
import { load } from '@loaders.gl/core';
import { ArrowLoader } from '@loaders.gl/arrow';

onMounted(() => {
  const $canvas = document.querySelector('ic-canvas');
  let canvas;
  $canvas.addEventListener('ic-ready', (e) => {
    canvas = e.detail;
  });

  (async () => {
    const pointData = await load('https://lmcinnes.github.io/datamapplot_examples/wikipedia_point_df.arrow', ArrowLoader);

    const { x, y, size, r, g, b, a } = pointData.data;

    // FIXME: use x.length
    (new Array(10000)).fill(undefined).forEach((_, i) => {
      const circle = new Circle({
        cx: x[i] * 100 + 400,
        cy: y[i] * 100 + 400,
        r: size[i] * 1000,
        fill: `rgba(${r[i]},${g[i]},${b[i]},${a[i] / 255})`,
        cullable: false,
      });
      canvas.appendChild(circle);
    });
  })();

});
</script>

<template>
  <ic-canvas></ic-canvas>
</template>
