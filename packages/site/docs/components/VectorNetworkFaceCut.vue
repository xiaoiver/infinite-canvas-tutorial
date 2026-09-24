<script setup lang="ts">
import VectorNetworkCube from './VectorNetworkCube.vue';

// A filled ring: V1–V4 are the outer corners, V5–V8 bound the hole.
const ring = {
  id: 'vn-hole-cut',
  vertices: [
    { x: 0, y: 0 },
    { x: 120, y: 0 },
    { x: 120, y: 120 },
    { x: 0, y: 120 },
    { x: 36, y: 36 },
    { x: 84, y: 36 },
    { x: 84, y: 84 },
    { x: 36, y: 84 },
  ],
  segments: [
    { start: 0, end: 1 },
    { start: 1, end: 2 },
    { start: 2, end: 3 },
    { start: 3, end: 0 },
    { start: 4, end: 5 },
    { start: 5, end: 6 },
    { start: 6, end: 7 },
    { start: 7, end: 4 },
  ],
  regions: [
    {
      fillRule: 'evenodd' as const,
      loops: [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
      ],
    },
  ],
};
</script>

<template>
  <VectorNetworkCube faces :network="ring" />
</template>
