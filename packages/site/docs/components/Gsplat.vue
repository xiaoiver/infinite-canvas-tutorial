<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { mat4, vec3 } from 'gl-matrix';

const wrapper = ref<HTMLDivElement | null>(null);

let cleanup: (() => void) | null = null;

// Build a small synthetic gaussian scene (a colorful point sphere shell) so the
// demo needs no external asset. Real scenes are loaded with `parseGsplat`.
async function buildScene() {
  const { GsplatData } = await import('@infinite-canvas-tutorial/gsplat');
  const count = 4000;
  const centers = new Float32Array(count * 3);
  const scales = new Float32Array(count * 3);
  const rotations = new Float32Array(count * 4);
  const colors = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    // Random point on a unit sphere.
    const u = Math.random() * 2 - 1;
    const t = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    const x = r * Math.cos(t);
    const y = u;
    const z = r * Math.sin(t);
    centers[i * 3 + 0] = x;
    centers[i * 3 + 1] = y;
    centers[i * 3 + 2] = z;
    scales[i * 3 + 0] = 0.02;
    scales[i * 3 + 1] = 0.02;
    scales[i * 3 + 2] = 0.02;
    rotations[i * 4 + 3] = 1; // identity quaternion (x,y,z,w)
    colors[i * 4 + 0] = x * 0.5 + 0.5;
    colors[i * 4 + 1] = y * 0.5 + 0.5;
    colors[i * 4 + 2] = z * 0.5 + 0.5;
    colors[i * 4 + 3] = 0.9; // opacity
  }
  return new GsplatData({ count, centers, scales, rotations, colors });
}

onMounted(async () => {
  if (typeof window === 'undefined' || !wrapper.value) return;

  const canvas = document.createElement('canvas');
  const width = 600;
  const height = 400;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  wrapper.value.appendChild(canvas);

  const { WebGLDeviceContribution } =
    await import('@infinite-canvas-tutorial/device-api');
  const { GsplatRenderer } = await import('@infinite-canvas-tutorial/gsplat');

  const deviceContribution = new WebGLDeviceContribution({
    targets: ['webgl2'],
    antialias: false,
  });
  const swapChain = await deviceContribution.createSwapChain(canvas);
  swapChain.configureSwapChain(canvas.width, canvas.height);
  const device = swapChain.getDevice();

  const renderer = new GsplatRenderer(device);
  renderer.setData(await buildScene());

  const projection = mat4.create();
  const view = mat4.create();
  const aspect = canvas.width / canvas.height;
  mat4.perspective(projection, (50 / 180) * Math.PI, aspect, 0.1, 100);

  let raf = 0;
  let angle = 0;
  let disposed = false;

  const frame = () => {
    if (disposed) return;
    angle += 0.005;
    const eye = vec3.fromValues(
      Math.cos(angle) * 3,
      1.2,
      Math.sin(angle) * 3,
    );
    mat4.lookAt(view, eye, [0, 0, 0], [0, 1, 0]);

    device.beginFrame();
    const onscreen = device.createRenderTargetFromTexture(
      swapChain.getOnscreenTexture(),
    );
    renderer.render(
      {
        viewMatrix: view,
        projectionMatrix: projection,
        width: canvas.width,
        height: canvas.height,
      },
      onscreen,
    );
    onscreen.destroy();
    device.endFrame();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  cleanup = () => {
    disposed = true;
    cancelAnimationFrame(raf);
    renderer.destroy();
    device.destroy();
    canvas.remove();
  };
});

onUnmounted(() => {
  cleanup?.();
  cleanup = null;
});
</script>

<template>
  <div ref="wrapper" class="gsplat-demo"></div>
</template>

<style scoped>
.gsplat-demo {
  display: inline-block;
  background: #000;
  border-radius: 4px;
  overflow: hidden;
}
</style>
