<script setup lang="ts">
import {
  FillTexture,
  FillTextureLive,
  GPUResource,
  MaterialDirty,
  type RectSerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import {
  Event,
  UIPlugin,
  type ExtendedAPI,
} from '@infinite-canvas-tutorial/webcomponents';
import { App as AntApp, Flex, message } from 'ant-design-vue';
import { onMounted, onUnmounted, ref } from 'vue';
import { ensureExampleWorld } from '../../lib/ensure-example-world';
import {
  EcsSineParticle,
  EcsSpectrumParticleAudio,
  SPECTRUM_PARTICLE_RECT_ID,
} from './index';

defineOptions({ name: 'SpectrumParticlesSine' });

const wrapper = ref<HTMLElement | null>(null);

let api: ExtendedAPI | undefined;
let audioDriver: EcsSpectrumParticleAudio | undefined;
let onReady: ((e: CustomEvent<ExtendedAPI>) => void) | undefined;
let onResized: ((e: CustomEvent<{ width: number; height: number }>) => void) | undefined;
let spectrumBootstrapped = false;

const particleRect = (): RectSerializedNode => ({
  id: SPECTRUM_PARTICLE_RECT_ID,
  type: 'rect',
  x: 60,
  y: 100,
  width: 520,
  height: 300,
  stroke: '#64748b',
  strokeWidth: 1,
  opacity: 1,
  zIndex: 0,
});

onMounted(async () => {
  const el = wrapper.value;
  if (!el) {
    return;
  }

  onReady = async (e: CustomEvent<ExtendedAPI>) => {
    if (spectrumBootstrapped) {
      return;
    }
    spectrumBootstrapped = true;
    api = e.detail;
    const $canvas = api.getCanvasElement();

    api.updateNodes([particleRect()]);

    const gpu = api.getCanvas().read(GPUResource);
    const effect = new EcsSineParticle();
    audioDriver = new EcsSpectrumParticleAudio({
      canvasElement: $canvas,
      effect,
    });
    await audioDriver.connect(gpu.device);

    const tex = effect.getTexture();
    const entity = api.getEntity(particleRect());
    if (!entity) {
      message.error('未找到粒子承载矩形实体');
      return;
    }
    api
      .getCommands()
      .entity(entity)
      .insert(
        new FillTexture(tex),
        new FillTextureLive(),
        new MaterialDirty(),
      );
    api.getCommands().execute();

    await audioDriver.play();
  };

  onResized = () => {
    audioDriver?.resize();
  };

  el.addEventListener(Event.READY, onReady as EventListener);
  el.addEventListener(Event.RESIZED, onResized as EventListener);
  await ensureExampleWorld([UIPlugin]);
});

onUnmounted(() => {
  const el = wrapper.value;
  if (el) {
    if (onReady) {
      el.removeEventListener(Event.READY, onReady as EventListener);
    }
    if (onResized) {
      el.removeEventListener(Event.RESIZED, onResized as EventListener);
    }
  }
  audioDriver?.destroy();
});

</script>

<template>
  <AntApp>
    <Flex vertical gap="small" style="width: 100%">
      <ic-spectrum-canvas ref="wrapper" renderer="webgpu" style="width: 100%; height: 420px" />
    </Flex>
  </AntApp>
</template>
