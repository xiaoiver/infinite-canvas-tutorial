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
import { Event } from '@infinite-canvas-tutorial/webcomponents';

/** Unit cube with per-face normals (24 verts, indexed). */
function createCubeGeometry(size = 1) {
  const h = size / 2;
  const faces: {
    normal: [number, number, number];
    verts: [number, number, number][];
  }[] = [
    { normal: [0, 0, 1], verts: [[-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]] },
    { normal: [0, 0, -1], verts: [[-h, -h, -h], [-h, h, -h], [h, h, -h], [h, -h, -h]] },
    { normal: [0, 1, 0], verts: [[-h, h, -h], [-h, h, h], [h, h, h], [h, h, -h]] },
    { normal: [0, -1, 0], verts: [[-h, -h, -h], [h, -h, -h], [h, -h, h], [-h, -h, h]] },
    { normal: [1, 0, 0], verts: [[h, -h, -h], [h, h, -h], [h, h, h], [h, -h, h]] },
    { normal: [-1, 0, 0], verts: [[-h, -h, -h], [-h, -h, h], [-h, h, h], [-h, h, -h]] },
  ];

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let base = 0;

  for (const { normal, verts } of faces) {
    for (const v of verts) {
      positions.push(...v);
      normals.push(...normal);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    base += 4;
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
  };
}

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
    const t0 = performance.now();

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
        eye: [2.8, 2.4, 4.2],
        center: [0, 0, 0],
        clearColor: true,
      }),
    );

    cubeEntity = commands
      .spawn(
        new Mesh3D({ positions, normals, indices }),
        new Material3D({
          baseColor: [0.25, 0.55, 0.95, 1],
          ambient: 0.15,
          diffuse: 0.75,
          specular: 0.4,
          shininess: 48,
        }),
        new Transform3D({
          translation: [0, 0, 0],
          rotation: [0.3, 0.6, 0],
          scale: [1, 1, 1],
        }),
      )
      .id()
      .hold();

    commands.execute();

    api.updateNodes([
      {
        id: 'overlay-rect',
        type: 'rect',
        zIndex: 1,
        fills: [{ type: 'solid', value: 'rgba(255, 120, 80, 0.45)' }],
        stroke: '#e85d04',
        strokeWidth: 2,
        x: 40,
        y: 40,
        width: 160,
        height: 100,
        cornerRadius: 12,
      },
    ]);

    const spin = (now: number) => {
      if (!cubeEntity) {
        return;
      }
      const t = (now - t0) / 1000;
      cubeEntity.write(Transform3D).rotation = [
        0.3 + t * 0.9,
        0.6 + t * 1.2,
        t * 0.5,
      ];
      spinRaf = requestAnimationFrame(spin);
    };
    spinRaf = requestAnimationFrame(spin);
  };

  canvas.addEventListener(Event.READY, onReady as EventListener);

  if (!(window as any).worldInited) {
    (window as any).worldInited = true;
    await ensureExampleWorld();
  }
});

onUnmounted(() => {
  const canvas = wrapper.value;
  if (spinRaf) {
    cancelAnimationFrame(spinRaf);
  }
  if (canvas && onReady) {
    canvas.removeEventListener(Event.READY, onReady as EventListener);
  }
  api?.destroy();
});
</script>

<template>
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 360px" />
</template>
