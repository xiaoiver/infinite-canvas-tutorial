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

const CUBE_ID = 'orthographic-cube1';
const BASE_ROTATION: [number, number, number] = [0.3, 0.6, 0];

/** 声明式场景：`mesh3d` 节点 + 2D 矩形叠加。 */
const sceneNodes: SerializedNode[] = [
  {
    id: 'rect1',
    type: 'rect',
    fills: [{ type: 'solid', value: 'red', opacity: 1 }],
    x: 400,
    y: 100,
    width: 100,
    height: 100,
    zIndex: 1,
  },
  {
    id: CUBE_ID,
    type: 'mesh3d',
    x: 150,
    y: 50,
    width: 100,
    height: 100,
    z: 40,
    zIndex: 0,
    scale3d: 100,
    rotation3d: BASE_ROTATION,
    material3d: {
      baseColor: '#ffffff',
      ambient: 0.25,
      diffuse: 0.75,
      specular: 0.4,
      shininess: 48,
    },
    camera3d: {
      linked: true,
      projection: 'orthographic',
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
      api.selectNodes([{ id: CUBE_ID, type: 'mesh3d' }]);

      // Companion mesh spawns next PostUpdate; start spin after that.
      api.runAtNextTick(() => {
        const cube = api.getNodeById(CUBE_ID);
        if (!cube) {
          return;
        }

        const t0 = performance.now();
        const spinCube = (now: number) => {
          const t = (now - t0) / 1000;
          const rotation3d: [number, number, number] = [
            BASE_ROTATION[0] + t * 0.9,
            BASE_ROTATION[1] + t * 1.2,
            t * 0.5,
          ];
          api.updateNode(cube, { rotation3d }, false);
          spinRaf = requestAnimationFrame(spinCube);
        };
        spinRaf = requestAnimationFrame(spinCube);
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
