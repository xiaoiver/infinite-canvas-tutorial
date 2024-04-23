<script setup>
import { Canvas, Group, Circle } from '@infinite-canvas-tutorial/lesson7';
import '@shoelace-style/shoelace/dist/themes/light.css';
import { ref, onMounted, onUnmounted } from 'vue';

const canvasRef = ref(null);
const resizeObserverRef = ref(null);
let canvas;
let rafId;
onMounted(async () => {
  // @see https://shoelace.style/tutorials/integrating-with-nextjs/#defining-custom-elements
  const { setBasePath } = await import(
    '@shoelace-style/shoelace/dist/utilities/base-path'
  );
  setBasePath(
    'https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.15.0/cdn/',
  );

  import(
    '@shoelace-style/shoelace/dist/components/button-group/button-group.js'
  );
  import('@shoelace-style/shoelace/dist/components/button/button.js');
  import('@shoelace-style/shoelace/dist/components/icon-button/icon-button.js');
  import('@shoelace-style/shoelace/dist/components/tooltip/tooltip.js');
  import(
    '@shoelace-style/shoelace/dist/components/resize-observer/resize-observer.js'
  );

  const $canvas = canvasRef.value;
  const $resizeObserver = resizeObserverRef.value;
  const dpr = window.devicePixelRatio;

  $resizeObserver.addEventListener('sl-resize', (event) => {
    const { width } = event.detail.entries[0].contentRect;
    resize(width, 500);
  });

  const resize = (width, height) => {
    if (width && height) {
      $canvas.width = width * dpr;
      $canvas.height = height * dpr;
      $canvas.style.width = `${width}px`;
      $canvas.style.height = `${height}px`;
      canvas?.resize(width, height);
    }
  };

  canvas = await new Canvas({
    canvas: $canvas,
    // renderer: 'webgpu',
    // shaderCompilerPath:
    //   'https://unpkg.com/@antv/g-device-api@1.6.8/dist/pkg/glsl_wgsl_compiler_bg.wasm',
  }).initialized;

  const solarSystem = new Group();
  const earthOrbit = new Group();
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

  const animate = () => {
    solarSystem.rotation += 0.01;
    earthOrbit.rotation += 0.02;

    canvas.render();
    rafId = requestAnimationFrame(animate);
  };
  animate();
});

onUnmounted(() => {
  canvas.destroy();
  cancelAnimationFrame(rafId);
});
</script>

<template>
  <sl-resize-observer ref="resizeObserverRef">
    <div :class="$style.container">
      <canvas ref="canvasRef"></canvas>
      <div :class="$style.zoomToolbar">
        <sl-button-group label="Zoom toolbar">
          <sl-tooltip content="Zoom out">
            <sl-icon-button
              name="dash-lg"
              label="Zoom out"
              @click="() => canvas.zoomOut()"
            ></sl-icon-button>
          </sl-tooltip>
          <sl-tooltip content="Zoom in">
            <sl-icon-button
              name="plus-lg"
              label="Zoom in"
              @click="() => canvas.zoomIn()"
            ></sl-icon-button>
          </sl-tooltip>
        </sl-button-group>
      </div>
    </div>
  </sl-resize-observer>
</template>

<style module>
canvas {
  outline: none;
  padding: 0;
  margin: 0;
  touch-action: none;
}
.container {
  position: relative;
}
.zoomToolbar {
  position: absolute;
  right: 16px;
  bottom: 16px;
  box-shadow: var(--sl-shadow-medium);
  background: white;
}
</style>
