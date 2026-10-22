<script setup lang="ts">
import { Pen } from '@infinite-canvas-tutorial/ecs';
import { Event } from '@infinite-canvas-tutorial/webcomponents';
import { onMounted, onUnmounted, ref } from 'vue';
import { ensureExampleWorld } from '../lib/ensure-example-world';

const props = defineProps<{ locale?: 'en' | 'zh' }>();
const wrapper = ref<HTMLElement | null>(null);
const lit = ref(false);
let api: any;
let onReady: ((event: CustomEvent) => void) | undefined;
let bootstrapped = false;

const updateMaterial = () => {
  const model = api?.getNodeById('vertex-colors');
  if (model)
    api.updateNode(model, { material3d: { unlit: !lit.value } }, false);
};

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) return;
  onReady = (event) => {
    if (bootstrapped) return;
    bootstrapped = true;
    api = event.detail;
    api.setAppState({
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT, Pen.HAND],
      penbarVisible: true,
      taskbarVisible: false,
    });
    api.runAtNextTick(() => {
      api.updateNodes([
        {
          id: 'vertex-color-ambient',
          type: 'light3d',
          lightType: 'ambient',
          intensity: 0.7,
        },
        {
          id: 'vertex-color-sun',
          type: 'light3d',
          lightType: 'directional',
          direction: [0.4, 0.5, 0.8],
          intensity: 1.2,
        },
        {
          id: 'vertex-colors',
          type: 'mesh3d',
          geometry: { type: 'gltf', url: '/data/VertexColors.gltf' },
          x: 120,
          y: 55,
          width: 220,
          height: 220,
          scale3d: 195,
          camera3d: {
            linked: true,
            projection: 'perspective',
            clearColor: false,
          },
        },
      ]);
    });
  };
  canvas.addEventListener(Event.READY, onReady as EventListener);
  await ensureExampleWorld();
});

onUnmounted(() => {
  bootstrapped = false;
  if (wrapper.value && onReady)
    wrapper.value.removeEventListener(Event.READY, onReady as EventListener);
  api = undefined;
});
</script>

<template>
  <div class="gltf-vertex-colors-example">
    <label>
      <input v-model="lit" type="checkbox" @change="updateMaterial" />
      {{ props.locale === 'zh' ? '启用场景光照' : 'Enable scene lighting' }}
    </label>
    <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 340px" />
  </div>
</template>

<style scoped>
.gltf-vertex-colors-example label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0.75rem 0;
}
</style>
