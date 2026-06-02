<script setup lang="ts">
import {
  Camera3D,
  Material3D,
  Mesh3D,
  Pen,
  Transform3D,
} from '@infinite-canvas-tutorial/ecs';
import { onMounted, onUnmounted, ref } from 'vue';
import { ensureExampleWorld } from '../lib/ensure-example-world';
import { createCubeGeometry } from '../lib/cube-geometry';
import { Event } from '@infinite-canvas-tutorial/webcomponents';

const wrapper = ref<HTMLElement | null>(null);
let api: any;
let onReady: ((e: CustomEvent) => void) | undefined;
let spinRaf = 0;
let cubeBootstrapped = false;
let cubeEntity: { write: (c: typeof Transform3D) => Transform3D } | undefined;

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  onReady = (e) => {
    if (cubeBootstrapped) {
      return;
    }
    cubeBootstrapped = true;
    api = e.detail;

    const rect1 = {
      id: 'rect1',
      type: 'rect',
      fills: [{ type: 'solid', value: 'red', opacity: 1 }],
      x: 400,
      y: 100,
      width: 100,
      height: 100,
    };

    api.setAppState({
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT, Pen.HAND],
      penbarVisible: false,
      taskbarVisible: false,
    });

    const { positions, normals, indices } = createCubeGeometry(1);
    const commands = api.getCommands();

    commands.spawn(
      new Camera3D({
        linked: true,
        projection: 'orthographic',
        clearColor: false,
      }),
    );

    cubeEntity = commands
      .spawn(
        new Mesh3D({ positions, normals, indices }),
        new Material3D({
          baseColor: [1, 1, 1, 1],
          ambient: 0.25,
          diffuse: 0.75,
          specular: 0.4,
          shininess: 48,
        }),
        new Transform3D({
          translation: [200, 100, 40],
          rotation: [0.3, 0.6, 0],
          scale: [100, 100, 100],
        }),
      )
      .id()
      .hold();

    commands.execute();

    api.updateNodes([rect1]);

    const t0 = performance.now();
    const spinCube = (now: number) => {
      if (!cubeEntity) {
        return;
      }
      const t = (now - t0) / 1000;
      const transform = cubeEntity.write(Transform3D);
      transform.rotation = [0.3 + t * 0.9, 0.6 + t * 1.2, t * 0.5];
      spinRaf = requestAnimationFrame(spinCube);
    };
    spinRaf = requestAnimationFrame(spinCube);
  };

  canvas.addEventListener(Event.READY, onReady as EventListener);

  await ensureExampleWorld();
});

onUnmounted(() => {
  const canvas = wrapper.value;
  if (spinRaf) {
    cancelAnimationFrame(spinRaf);
  }
  if (canvas && onReady) {
    canvas.removeEventListener(Event.READY, onReady as EventListener);
  }
});
</script>

<template>
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 360px" />
</template>
