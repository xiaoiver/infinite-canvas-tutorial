<script setup lang="ts">
import { Pen } from '@infinite-canvas-tutorial/ecs';
import { onMounted, onUnmounted, ref } from 'vue';
import { ensureExampleWorld } from '../lib/ensure-example-world';
import { Event } from '@infinite-canvas-tutorial/webcomponents';

const wrapper = ref<HTMLElement | null>(null);
let api: any;
let onReady: ((e: CustomEvent) => void) | undefined;
let animRaf = 0;
let bootstrapped = false;

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  onReady = (e) => {
    if (bootstrapped) {
      return;
    }
    bootstrapped = true;
    api = e.detail;

    api.setAppState({
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT, Pen.HAND],
      penbarVisible: true,
      taskbarVisible: false,
    });

    api.runAtNextTick(() => {
      api.updateNodes([
        {
          id: 'light-ambient',
          type: 'light3d',
          lightType: 'ambient',
          intensity: 0.4,
          zIndex: -3,
        },
        {
          id: 'light-key',
          type: 'light3d',
          lightType: 'directional',
          direction: [1, 0, 0],
          intensity: 0.9,
          zIndex: -3,
        },
        {
          id: 'duck',
          type: 'mesh3d',
          geometry: { type: 'gltf', url: '/data/Duck.gltf' },
          x: 120,
          y: 80,
          width: 120,
          height: 120,
          z: 40,
          zIndex: 0,
          scale3d: 140,
          rotation3d: [0.2, 0.5, 0],
          material3d: {
            baseColor: '#ffffff',
            ambient: 0.25,
            diffuse: 0.8,
            specular: 0.35,
            shininess: 48,
          },
          camera3d: {
            linked: true,
            projection: 'perspective',
            clearColor: false,
          },
        },
      ]);

      api.runAtNextTick(() => {
        const duck = api.getNodeById('duck');
        if (!duck) {
          return;
        }
        const t0 = performance.now();
        const animate = (now: number) => {
          const t = (now - t0) / 1000;
          api.updateNode(
            duck,
            {
              rotation3d: [0.2 + t * 0.35, 0.5 + t * 0.55, t * 0.25],
            },
            false,
          );
          animRaf = requestAnimationFrame(animate);
        };
        animRaf = requestAnimationFrame(animate);
      });
    });
  };

  canvas.addEventListener(Event.READY, onReady as EventListener);
  await ensureExampleWorld();
});

onUnmounted(() => {
  bootstrapped = false;
  const canvas = wrapper.value;
  if (animRaf) {
    cancelAnimationFrame(animRaf);
  }
  if (canvas && onReady) {
    canvas.removeEventListener(Event.READY, onReady as EventListener);
  }
});
</script>

<template>
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 360px" />
</template>
