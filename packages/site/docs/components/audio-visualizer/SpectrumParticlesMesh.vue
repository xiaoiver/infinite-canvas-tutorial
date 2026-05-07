<script setup lang="ts">
import {
  App,
  DefaultPlugins,
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
import { App as AntApp, Button, Flex, Upload, message } from 'ant-design-vue';
import { CloudUploadOutlined, FileOutlined } from '@ant-design/icons-vue';
import { onMounted, onUnmounted, ref } from 'vue';
import {
  EcsMeshParticle,
  EcsSpectrumParticleAudio,
  loadMeshTriangleSoupFromFile,
  SPECTRUM_PARTICLE_MESH_RECT_ID,
} from './effects/ecs';

defineOptions({ name: 'SpectrumParticlesMesh' });

const wrapper = ref<HTMLElement | null>(null);
const loadingAudio = ref(false);
const loadingMesh = ref(false);

let api: ExtendedAPI | undefined;
let audioDriver: EcsSpectrumParticleAudio | undefined;
let meshEffect: EcsMeshParticle | undefined;
let onReady: ((e: CustomEvent<ExtendedAPI>) => void) | undefined;
let onResized: ((e: CustomEvent<{ width: number; height: number }>) => void) | undefined;
let spectrumBootstrapped = false;

const particleRect = (): RectSerializedNode => ({
  id: SPECTRUM_PARTICLE_MESH_RECT_ID,
  type: 'rect',
  x: 60,
  y: 100,
  width: 520,
  height: 300,
  stroke: '#64748b',
  strokeWidth: 1,
  opacity: 1,
});

onMounted(async () => {
  const el = wrapper.value;
  if (!el) {
    return;
  }

  if (!(window as unknown as { worldInited?: boolean }).worldInited) {
    (window as unknown as { worldInited?: boolean }).worldInited = true;
    await import('@infinite-canvas-tutorial/webcomponents/spectrum');
    new App().addPlugins(...DefaultPlugins, UIPlugin).run();
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
    const effect = new EcsMeshParticle();
    meshEffect = effect;
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
  meshEffect = undefined;
  api?.destroy();
});

const handleUploadAudio = (file: File) => {
  if (!audioDriver) {
    message.error('画布未就绪');
    return false;
  }

  loadingAudio.value = true;
  const $audio = document.createElement('audio');
  $audio.controls = true;
  $audio.src = URL.createObjectURL(file);
  $audio.load();
  $audio.play().finally(() => {
    loadingAudio.value = false;
  });
  audioDriver.data($audio);
  return false;
};

const handleUploadMesh = async (file: File) => {
  if (!meshEffect) {
    message.error('画布未就绪');
    return false;
  }
  const lower = file.name.toLowerCase();
  if (
    !lower.endsWith('.glb') &&
    !lower.endsWith('.gltf') &&
    !lower.endsWith('.obj')
  ) {
    message.error('请上传 .glb / .gltf / .obj');
    return false;
  }

  loadingMesh.value = true;
  try {
    const soup = await loadMeshTriangleSoupFromFile(file);
    const tc = soup.indices
      ? soup.indices.length / 3
      : soup.positions.length / 9;
    if (tc < 1) {
      message.warning('未解析到三角面，请换模型或优先使用 .glb');
    } else {
      meshEffect.setMeshSoup(soup);
      message.success(`已采样约 ${meshEffect.getParticleCount()} 粒子（表面均匀）`);
    }
  } catch (err) {
    console.error(err);
    message.error(
      err instanceof Error ? err.message : '模型解析失败（外链 .bin 的 .gltf 需自行提供 base URL）',
    );
  } finally {
    loadingMesh.value = false;
  }
  return false;
};
</script>

<template>
  <AntApp>
    <Flex vertical gap="small" style="width: 100%">
      <Flex gap="small" wrap="wrap">
        <Upload
          :before-upload="handleUploadMesh"
          :show-upload-list="false"
          accept=".glb,.gltf,.obj"
        >
          <Button :loading="loadingMesh">
            <template #icon>
              <FileOutlined />
            </template>
            上传 3D 模型（表面均匀采样）
          </Button>
        </Upload>
        <Upload
          :before-upload="handleUploadAudio"
          :show-upload-list="false"
          accept="audio/*"
        >
          <Button :loading="loadingAudio">
            <template #icon>
              <CloudUploadOutlined />
            </template>
            上传音频（可选）
          </Button>
        </Upload>
      </Flex>
      <ic-spectrum-canvas
        ref="wrapper"
        renderer="webgpu"
        style="width: 100%; height: 420px"
      />
    </Flex>
  </AntApp>
</template>
