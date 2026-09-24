<script setup lang="ts">
import { type API, type VectorNetworkSerializedNode, Pen, VectorNetworkEditMode } from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { ensureExampleWorld } from '../lib/ensure-example-world';
import { createVectorNetworkCubeNode } from '../lib/vector-network-cube';
import { Event } from '@infinite-canvas-tutorial/webcomponents';

const props = defineProps<{ fill?: boolean; topology?: boolean; faces?: boolean; edges?: boolean; network?: Pick<VectorNetworkSerializedNode, 'id' | 'vertices' | 'segments' | 'regions'> }>();
const wrapper = ref<HTMLElement | null>(null);
let disposed = false;
let onReady: EventListener | undefined;

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  onReady = (e) => {
    const api = (e as CustomEvent<API>).detail;
    // READY fires inside an ECS system; defer scene writes until the next tick.
    api.runAtNextTick(() => {
      if (disposed) return;

      const cube = createVectorNetworkCubeNode({
        id: props.fill ? 'vn-cube-fill' : props.topology ? 'vn-cube-topology' : props.faces ? 'vn-cube-faces' : props.edges ? 'vn-cube-edges' : 'vn-cube',
        version: 1,
        regions: props.edges
          ? [
              { fillRule: 'evenodd', loops: [[0, 1, 2, 3]] },
              { fillRule: 'evenodd', loops: [[2, 4, 5, 6]] },
              { fillRule: 'evenodd', loops: [[1, 6, 8, 7]] },
            ]
          : props.faces ? [{ fillRule: 'evenodd', loops: [[0, 1, 2, 3]] }] : [],
        ...(props.faces || props.edges ? { fills: [{ type: 'solid' as const, value: '#b7d6ff' }] } : {}),
        ...props.network,
      });
      const focused = props.fill || props.topology || props.faces || props.edges;
      const zoom = focused ? 1.8 : 1;
      api.updateNodes([cube]);
      api.selectNodes([cube]);
      const node = api.getNodeById(cube.id);
      if (!node) return;
      api.updateNode(node, { isEditing: true });
      const { clientWidth, clientHeight } = api.getCanvasElement();
      const { x = 0, y = 0, width = 110, height = 110 } = node;
      api.setAppState({
        penbarSelected: Pen.SELECT,
        penbarAll: [Pen.SELECT, Pen.VECTOR_NETWORK],
        vectorNetworkEditMode: props.fill
          ? VectorNetworkEditMode.FILL
          : VectorNetworkEditMode.MOVE,
        cameraZoom: zoom,
        cameraX: focused
          ? x + width / 2 - clientWidth / (2 * zoom)
          : -120,
        cameraY: focused
          ? y + height / 2 - (clientHeight - 96) / (2 * zoom)
          : -80,
      });
      // Seed history so the first edit can be undone without removing the cube.
      api.record();
    });
  };

  canvas.addEventListener(Event.READY, onReady);

  await ensureExampleWorld();
});

onBeforeUnmount(() => {
  disposed = true;
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  if (onReady) {
    canvas.removeEventListener(Event.READY, onReady);
  }
});
</script>

<template>
  <ic-spectrum-canvas
    ref="wrapper"
    :style="{ width: '100%', height: fill || topology || faces || edges ? '400px' : '360px' }"
  ></ic-spectrum-canvas>
</template>
