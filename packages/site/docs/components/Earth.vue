<script setup lang="ts">
import { Pen } from '@infinite-canvas-tutorial/ecs';
import type { SerializedNode } from '@infinite-canvas-tutorial/ecs';
import { onMounted, onUnmounted, ref } from 'vue';
import { ensureExampleWorld } from '../lib/ensure-example-world';
import { Event } from '@infinite-canvas-tutorial/webcomponents';

const wrapper = ref<HTMLElement | null>(null);
let api: any;
let onReady: ((e: CustomEvent) => void) | undefined;
let spinRaf = 0;
let bootstrapped = false;

const EARTH_ID = 'earth1';
const BASE_ROTATION: [number, number, number] = [0.15, 0, 0];

/** Equirectangular Earth base-color texture (same asset as the AntV G demo). */
const EARTH_MAP =
  'https://gw.alipayobjects.com/mdn/rms_6ae20b/afts/img/A*npAsSLPX4A4AAAAAAAAAAAAAARQnAQ';

/** 声明式场景：环境光 + 平行光 + 贴图球体（地球）。 */
const sceneNodes: SerializedNode[] = [
  {
    id: 'light-ambient',
    type: 'light3d',
    lightType: 'ambient',
    intensity: 0.45,
    zIndex: -3,
  },
  {
    id: 'light-sun',
    type: 'light3d',
    lightType: 'directional',
    direction: [-0.6, -0.2, -0.55],
    intensity: 0.9,
    zIndex: -3,
  },
  {
    id: EARTH_ID,
    type: 'mesh3d',
    geometry: { type: 'sphere', segments: [48, 32] },
    x: 200,
    y: 120,
    width: 120,
    height: 120,
    z: 40,
    zIndex: 0,
    scale3d: 120,
    rotation3d: BASE_ROTATION,
    material3d: {
      baseColor: '#ffffff',
      ambient: 0.5,
      diffuse: 0.85,
      specular: 0.15,
      shininess: 16,
      map: EARTH_MAP,
    },
    camera3d: {
      linked: true,
      projection: 'perspective',
      clearColor: false,
    },
  },
];

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
      penbarVisible: false,
      taskbarVisible: false,
    });

    // Defer past PreStartUp (READY) so ECS change tracking sees mesh3d inserts cleanly.
    api.runAtNextTick(() => {
      api.updateNodes(sceneNodes);

      // Companion mesh spawns next PostUpdate; start spin after that.
      api.runAtNextTick(() => {
        const earth = api.getNodeById(EARTH_ID);
        if (!earth) {
          return;
        }

        const t0 = performance.now();
        const spinEarth = (now: number) => {
          const t = (now - t0) / 1000;
          const rotation3d: [number, number, number] = [
            BASE_ROTATION[0],
            BASE_ROTATION[1] + t * 0.4,
            BASE_ROTATION[2],
          ];
          api.updateNode(earth, { rotation3d }, false);
          spinRaf = requestAnimationFrame(spinEarth);
        };
        spinRaf = requestAnimationFrame(spinEarth);
      });
    });
  };

  canvas.addEventListener(Event.READY, onReady as EventListener);

  await ensureExampleWorld();
});

onUnmounted(() => {
  bootstrapped = false;
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
