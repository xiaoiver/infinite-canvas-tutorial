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
import {
  App as AntApp,
  Button,
  Flex,
  InputNumber,
  Segmented,
  Slider,
  Typography,
  Upload,
  message,
} from 'ant-design-vue';
import { CloudUploadOutlined, FileOutlined } from '@ant-design/icons-vue';
import { onMounted, onUnmounted, ref } from 'vue';
import { ensureExampleWorld } from '../../lib/ensure-example-world';
import {
  DEFAULT_MESH_SAMPLE_COUNT,
  EcsMeshParticle,
  EcsSpectrumParticleAudio,
  loadMeshTriangleSoupFromFile,
  logMeshTriangleSoupDiagnostics,
  SPECTRUM_PARTICLE_MESH_RECT_ID,
  type MeshTriangleSoup,
} from './index';

/** 与 `@infinite-canvas-tutorial/particle` 的 {@link MeshSurfaceSampleStrategy} 一致 */
type MeshSampleStrategyUi = 'area' | 'perTriangle';

const SAMPLE_STRATEGY_OPTIONS: { label: string; value: MeshSampleStrategyUi }[] = [
  { label: '面积加权 area', value: 'area' },
  { label: '三角个数均分', value: 'perTriangle' },
];

defineOptions({ name: 'SpectrumParticlesMesh' });

const wrapper = ref<HTMLElement | null>(null);
const loadingAudio = ref(false);
const loadingMesh = ref(false);

/** 与 {@link EcsMeshParticle} 取景参数一致，滑块实时 `update` */
const frameMeshScale = ref(1);
const frameViewFov = ref(1.2);
const frameViewDistanceScale = ref(1);
const frameViewDistanceBias = ref(0);
const frameMeshOx = ref(0);
const frameMeshOy = ref(0);
const frameMeshOz = ref(0);
/** 绕竖直轴公转角速度（弧度/秒），叠在鼠标左右视角上；0 关闭 */
const frameOrbitYawSpeed = ref(0.12);
/** 画布 READY 后显示构图控件（meshEffect 非响应式，用 ref 触发渲染） */
const frameControlsReady = ref(false);

/** 面积加权采样：粒子越多越易覆盖小鸭眼睛等小块区域；拖动结束后再重采样以避免卡顿 */
const frameTargetSampleCount = ref(DEFAULT_MESH_SAMPLE_COUNT);
const frameSampleStrategy = ref<MeshSampleStrategyUi>('area');
/** 最近一次成功加载的网格，用于只改采样数不重传文件 */
let lastLoadedSoup: MeshTriangleSoup | undefined;

function refreshParticleFillTextureDirty() {
  const entity = api?.getEntity(particleRect());
  if (entity && api) {
    api.getCommands().entity(entity).insert(new MaterialDirty());
    api.getCommands().execute();
  }
}

/** 写入 targetSampleCount；若已有模型则 CPU 重新表面采样并重绑 GPU */
function applySurfaceSampleCount(commit = true) {
  if (!meshEffect) {
    return;
  }
  const n = Math.max(
    1000,
    Math.min(65_536, Math.floor(Number(frameTargetSampleCount.value))),
  );
  frameTargetSampleCount.value = n;
  meshEffect.update({
    targetSampleCount: n,
    meshSampleStrategy: frameSampleStrategy.value,
  } as never);
  if (!commit) {
    return;
  }
  if (!lastLoadedSoup) {
    /* 尚无网格：只写入 targetSampleCount，下次上传即用 */
    return;
  }
  meshEffect.setMeshSoup(lastLoadedSoup);
  refreshParticleFillTextureDirty();
  message.success(`已重采样 ${meshEffect.getParticleCount()} 粒子`);
}

function onSampleStrategyChange() {
  applySurfaceSampleCount(true);
}

function pushFrameParams() {
  if (!meshEffect) {
    return;
  }
  /* 构图字段定义于源码 EcsMeshParticleOptions；若本地 particle 的 lib.d.ts 未重建，避免多余属性校验 */
  meshEffect.update({
    meshScale: frameMeshScale.value,
    meshOffset: [
      Number(frameMeshOx.value ?? 0),
      Number(frameMeshOy.value ?? 0),
      Number(frameMeshOz.value ?? 0),
    ],
    viewFov: frameViewFov.value,
    viewDistanceScale: frameViewDistanceScale.value,
    viewDistanceBias: frameViewDistanceBias.value,
    orbitYawSpeed: Number(frameOrbitYawSpeed.value ?? 0),
  } as never);
}

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
    const effect = new EcsMeshParticle();
    meshEffect = effect;
    frameControlsReady.value = true;
    frameTargetSampleCount.value = DEFAULT_MESH_SAMPLE_COUNT;
    lastLoadedSoup = undefined;
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
    applySurfaceSampleCount(false);
    pushFrameParams();
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
  frameControlsReady.value = false;
  if (lastLoadedSoup?.baseColorImage) {
    try {
      lastLoadedSoup.baseColorImage.close();
    } catch {
      /* noop */
    }
  }
  lastLoadedSoup = undefined;
  audioDriver?.destroy();
  meshEffect = undefined;
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
    message.error('请上传 .glb / .gltf（含内嵌 Embedded）/ .obj');
    return false;
  }

  loadingMesh.value = true;
  try {
    const soup = await loadMeshTriangleSoupFromFile(file);
    if (import.meta.env.DEV) {
      logMeshTriangleSoupDiagnostics(soup, '[SpectrumParticlesMesh] raw soup');
    }
    const tc = soup.indices
      ? soup.indices.length / 3
      : soup.positions.length / 9;
    if (tc < 1) {
      message.warning(
        '未解析到三角面。若 GLB 使用 Draco 压缩，请换未压缩导出或改用 .obj。',
      );
    } else {
      const prevSoup = lastLoadedSoup;
      if (prevSoup?.baseColorImage && prevSoup !== soup) {
        try {
          prevSoup.baseColorImage.close();
        } catch {
          /* already detached */
        }
      }
      lastLoadedSoup = soup;
      meshEffect.update({
        targetSampleCount: Math.min(
          65_536,
          Math.floor(frameTargetSampleCount.value),
        ),
        meshSampleStrategy: frameSampleStrategy.value,
      } as never);
      meshEffect.setMeshSoup(soup);
      if (import.meta.env.DEV) {
        console.info(
          '[SpectrumParticlesMesh] particle count',
          meshEffect.getParticleCount(),
        );
      }
      refreshParticleFillTextureDirty();
      message.success(`已采样约 ${meshEffect.getParticleCount()} 粒子（表面均匀）`);
    }
  } catch (err) {
    console.error(err);
    message.error(
      err instanceof Error
        ? err.message
        : '模型解析失败（外链 .bin 的 .gltf 需与资源一并上传或改用内嵌 / GLB）',
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
          accept=".glb,.gltf,.obj,model/gltf-binary,model/gltf+json"
        >
          <Button :loading="loadingMesh">
            <template #icon>
              <FileOutlined />
            </template>
            上传 3D 模型（GLB / 内嵌 glTF / OBJ）
          </Button>
        </Upload>
        <Upload :before-upload="handleUploadAudio" :show-upload-list="false" accept="audio/*">
          <Button :loading="loadingAudio">
            <template #icon>
              <CloudUploadOutlined />
            </template>
            上传音频（可选）
          </Button>
        </Upload>
      </Flex>

      <div
        v-if="frameControlsReady"
        style="max-width: 560px; padding: 8px 0 4px; border-top: 1px solid #e2e8f0"
      >
        <Typography.Text type="secondary" style="display: block; margin-bottom: 6px">
          表面采样策略与粒子数（≤65536）
        </Typography.Text>
        <Typography.Paragraph
          type="secondary"
          style="margin: 0 0 8px; font-size: 12px; line-height: 1.5"
        >
          <strong>面积加权</strong>：大三角更容易被抽到；小鸭眼睛等小三角可多试<strong>三角个数均分</strong>
          ，总粒子在每个三角上分得更匀。两种方式都可把数量拖到 3 万～6 万再看细节。
        </Typography.Paragraph>
        <div style="margin-bottom: 10px">
          <Segmented
            v-model:value="frameSampleStrategy"
            :options="SAMPLE_STRATEGY_OPTIONS"
            @change="onSampleStrategyChange"
          />
        </div>
        <Flex vertical gap="small" style="margin-bottom: 12px">
          <div>
            <span style="font-size: 12px; color: #64748b">{{ frameTargetSampleCount.toLocaleString() }} 粒子</span>
            <Slider
              v-model:value="frameTargetSampleCount"
              :min="2000"
              :max="65536"
              :step="512"
              :tooltip="{ formatter: (v) => (v != null ? `${v.toLocaleString()} 点` : '') }"
              @afterChange="() => applySurfaceSampleCount(true)"
            />
          </div>
          <Flex gap="small" align="center" wrap="wrap">
            <InputNumber
              v-model:value="frameTargetSampleCount"
              :min="1000"
              :max="65536"
              :step="1000"
              size="small"
              style="width: 120px"
              @pressEnter="applySurfaceSampleCount(true)"
            />
            <Button size="small" @click="applySurfaceSampleCount(true)">重采样</Button>
          </Flex>
        </Flex>

        <Typography.Text type="secondary" style="display: block; margin-bottom: 8px">
          构图（网格缩放 / 平移 / 视野与相机距离）
        </Typography.Text>
        <Flex vertical gap="small">
          <div>
            <span style="font-size: 12px; color: #64748b">模型缩放 meshScale · {{ frameMeshScale.toFixed(2) }}</span>
            <Slider
              v-model:value="frameMeshScale"
              :min="0.25"
              :max="1.5"
              :step="0.01"
              :tooltip="{ formatter: (v) => String(v) }"
              @change="pushFrameParams"
            />
          </div>
          <div>
            <span style="font-size: 12px; color: #64748b">视野 viewFov · {{ frameViewFov.toFixed(2) }}</span>
            <Slider
              v-model:value="frameViewFov"
              :min="0.6"
              :max="2.2"
              :step="0.02"
              :tooltip="{ formatter: (v) => String(v) }"
              @change="pushFrameParams"
            />
          </div>
          <div>
            <span style="font-size: 12px; color: #64748b">距离倍率 · {{ frameViewDistanceScale.toFixed(2) }}</span>
            <Slider
              v-model:value="frameViewDistanceScale"
              :min="0.4"
              :max="2.5"
              :step="0.02"
              :tooltip="{ formatter: (v) => String(v) }"
              @change="pushFrameParams"
            />
          </div>
          <div>
            <span style="font-size: 12px; color: #64748b">距离偏移 bias · {{ frameViewDistanceBias.toFixed(2) }}</span>
            <Slider
              v-model:value="frameViewDistanceBias"
              :min="-0.5"
              :max="3"
              :step="0.02"
              :tooltip="{ formatter: (v) => String(v) }"
              @change="pushFrameParams"
            />
          </div>
          <div>
            <span style="font-size: 12px; color: #64748b">
              缓慢公转 orbitYawSpeed · {{ Number(frameOrbitYawSpeed ?? 0).toFixed(3) }} rad/s（≈
              {{
                Number(frameOrbitYawSpeed) > 0.001
                  ? Math.round((2 * Math.PI) / Number(frameOrbitYawSpeed))
                  : '∞'
              }}
              秒/圈）
            </span>
            <Slider
              v-model:value="frameOrbitYawSpeed"
              :min="0"
              :max="0.5"
              :step="0.01"
              :tooltip="{ formatter: (v) => String(v) }"
              @change="pushFrameParams"
            />
          </div>
          <Flex gap="small" wrap="wrap" align="center">
            <span style="font-size: 12px; color: #64748b">平移 meshOffset</span>
            <InputNumber
              v-model:value="frameMeshOx"
              size="small"
              :step="0.02"
              :min="-0.8"
              :max="0.8"
              placeholder="X"
              style="width: 72px"
              @change="pushFrameParams"
            />
            <InputNumber
              v-model:value="frameMeshOy"
              size="small"
              :step="0.02"
              :min="-0.8"
              :max="0.8"
              placeholder="Y"
              style="width: 72px"
              @change="pushFrameParams"
            />
            <InputNumber
              v-model:value="frameMeshOz"
              size="small"
              :step="0.02"
              :min="-0.8"
              :max="0.8"
              placeholder="Z"
              style="width: 72px"
              @change="pushFrameParams"
            />
          </Flex>
        </Flex>
      </div>

      <ic-spectrum-canvas ref="wrapper" renderer="webgpu" style="width: 100%; height: 420px" />
    </Flex>
  </AntApp>
</template>
