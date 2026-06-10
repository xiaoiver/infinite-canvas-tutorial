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

const sceneCenter = { x: 220, y: 180, z: 40 };
const spotLift = 200;
const spotBack = 160;

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
        intensity: 0.35,
        zIndex: -3,
      },
      {
        id: 'light-key',
        type: 'light3d',
        lightType: 'directional',
        direction: [-0.45, -0.65, -0.55],
        intensity: 0.85,
        zIndex: -3,
      },
      {
        id: 'light-fill',
        type: 'light3d',
        lightType: 'directional',
        direction: [0.12, -0.28, 0.88],
        intensity: 0.42,
        zIndex: -3,
      },
      {
        id: 'light-spot',
        type: 'light3d',
        lightType: 'spot',
        x: sceneCenter.x,
        y: sceneCenter.y - spotLift,
        z: sceneCenter.z + spotBack,
        direction: [0, spotLift, -spotBack],
        color: '#ffe6b3',
        intensity: 1.4,
        range: 0,
        zIndex: -3,
      },
      {
        id: 'cube-red',
        type: 'mesh3d',
        x: 80,
        y: 140,
        width: 80,
        height: 80,
        z: 40,
        zIndex: 0,
        scale3d: 80,
        rotation3d: [0.35, 0.5, 0],
        material3d: {
          baseColor: '#f25952',
          ambient: 0.25,
          diffuse: 0.75,
          specular: 0.35,
          shininess: 32,
          metallic: 0,
          roughness: 0.55,
        },
        camera3d: {
          linked: true,
          projection: 'perspective',
          clearColor: false,
        },
      },
      {
        id: 'sphere-white',
        type: 'mesh3d',
        geometry: { type: 'sphere', segments: [24, 16] },
        x: 180,
        y: 140,
        width: 80,
        height: 80,
        z: 40,
        zIndex: 0,
        scale3d: 70,
        rotation3d: [0.35, 0.5, 0],
        material3d: {
          baseColor: '#ebeff2',
          ambient: 0.25,
          diffuse: 0.75,
          specular: 0.65,
          shininess: 96,
          metallic: 1,
          roughness: 0.25,
        },
      },
      {
        id: 'cylinder-blue',
        type: 'mesh3d',
        geometry: { type: 'cylinder', segments: 24 },
        x: 280,
        y: 140,
        width: 70,
        height: 90,
        z: 40,
        zIndex: 0,
        scale3d: [60, 80, 60],
        rotation3d: [0.35, 0.5, 0],
        material3d: {
          baseColor: '#478cf2',
          ambient: 0.25,
          diffuse: 0.75,
          specular: 0.45,
          shininess: 48,
          metallic: 0,
          roughness: 0.2,
        },
      },
    ]);

      api.runAtNextTick(() => {
        const spot = api.getNodeById('light-spot');
        const meshes = [
          { node: api.getNodeById('cube-red'), phase: 0 },
          { node: api.getNodeById('sphere-white'), phase: 0.15 },
          { node: api.getNodeById('cylinder-blue'), phase: 0.3 },
        ] as const;
        if (!spot) {
          return;
        }

        const t0 = performance.now();
        const animate = (now: number) => {
          const t = (now - t0) / 1000;
          const orbit = 90;
          const px = sceneCenter.x + Math.cos(t * 0.85) * orbit;
          const py = sceneCenter.y - spotLift + Math.sin(t * 1.1) * 24;
          const pz = sceneCenter.z + spotBack + Math.sin(t * 0.85) * orbit * 0.45;
          const dx = sceneCenter.x - px;
          const dy = sceneCenter.y - py;
          const dz = sceneCenter.z - pz;
          const len = Math.hypot(dx, dy, dz) || 1;

          api.updateNode(
            spot,
            {
              x: px,
              y: py,
              z: pz,
              direction: [dx / len, dy / len, dz / len],
            },
            false,
          );

          for (const { node, phase } of meshes) {
            if (!node) {
              continue;
            }
            const rotation3d: [number, number, number] = [
              0.35 + t * (0.6 + phase),
              0.5 + t * (0.9 + phase * 0.66),
              t * 0.35,
            ];
            api.updateNode(node, { rotation3d }, false);
          }

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
