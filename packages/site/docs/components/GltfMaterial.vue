<script setup lang="ts">
import { Pen } from '@infinite-canvas-tutorial/ecs';
import { Event } from '@infinite-canvas-tutorial/webcomponents';
import { onMounted, onUnmounted, ref } from 'vue';
import { ensureExampleWorld } from '../lib/ensure-example-world';

const props = defineProps<{ locale?: 'en' | 'zh' }>();
const wrapper = ref<HTMLElement | null>(null);
const normalEnabled = ref(true);
const occlusionEnabled = ref(true);
const doubleSidedEnabled = ref(true);
let api: any;
let onReady: ((event: CustomEvent) => void) | undefined;
let bootstrapped = false;

const updateMaterial = () => {
  const model = api?.getNodeById('normal-tangent-test');
  if (!model) return;
  api.updateNode(
    model,
    {
      material3d: {
        ...(!normalEnabled.value ? { normalMap: null } : {}),
        ...(!occlusionEnabled.value ? { occlusionMap: null } : {}),
        doubleSided: doubleSidedEnabled.value,
      },
    },
    false,
  );
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
          id: 'material-ambient',
          type: 'light3d',
          lightType: 'ambient',
          intensity: 0.75,
        },
        {
          id: 'material-sun',
          type: 'light3d',
          lightType: 'directional',
          direction: [0.5, 0.4, 0.8],
          intensity: 1.4,
        },
        {
          id: 'normal-tangent-test',
          type: 'mesh3d',
          geometry: { type: 'gltf', url: '/data/NormalTangentTest.glb' },
          x: 160,
          y: 70,
          width: 220,
          height: 220,
          scale3d: 185,
          rotation3d: [0.2, 0.3, 0],
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
  <div class="gltf-material-example">
    <div class="gltf-material-controls">
      <label
        ><input
          v-model="normalEnabled"
          type="checkbox"
          @change="updateMaterial"
        />{{ props.locale === 'zh' ? '法线贴图' : 'Normal map' }}</label
      >
      <label
        ><input
          v-model="occlusionEnabled"
          type="checkbox"
          @change="updateMaterial"
        />{{ props.locale === 'zh' ? '环境遮蔽' : 'Occlusion' }}</label
      >
      <label
        ><input
          v-model="doubleSidedEnabled"
          type="checkbox"
          @change="updateMaterial"
        />{{ props.locale === 'zh' ? '双面材质' : 'Double sided' }}</label
      >
    </div>
    <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 360px" />
  </div>
</template>

<style scoped>
.gltf-material-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin: 0.75rem 0;
}
.gltf-material-controls label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
</style>
