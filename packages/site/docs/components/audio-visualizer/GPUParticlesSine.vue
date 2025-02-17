<script setup lang="tsx">
import { CloudUploadOutlined } from '@ant-design/icons-vue';
import { App, Button, Flex, Upload, message } from 'ant-design-vue';
import { Audio, Sine } from './index';
import { ref, onMounted } from 'vue';
import Stats from 'stats.js';

defineOptions({ name: 'GPU Particles' });

const wrapper = ref(null);
const loading = ref(false);
let canvas = null;
let audio = null;
let effect = null;

onMounted(() => {
    import('@infinite-canvas-tutorial/ui');

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    const $canvas = wrapper.value;

    if (!$canvas) return;

    $canvas.parentElement.appendChild($stats);

    $canvas.addEventListener('ic-ready', (e) => {
        canvas = e.detail;

        effect = new Sine();
        audio = new Audio({ canvas });
        audio.effect(effect);
        audio.play();
    });

    $canvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });

    $canvas.addEventListener('ic-resized', (e) => {
        effect.resize(e.detail.width, e.detail.height);
    });
});

const handleUpload = (file: File) => {
  if (!canvas) {
    message.error('Canvas 未准备就绪');
    return false;
  }

  loading.value = true;

  const $audio = document.createElement('audio');
  $audio.controls = true;
  $audio.src = URL.createObjectURL(file);
  $audio.load();
  $audio.play();

  if (audio) {
    audio.data($audio);
  }
  
  return false;
};

const Demo = () => {
  return (<div>
    <div style="position: relative">
      <ic-canvas ref={wrapper} style="height: 400px" renderer="webgpu" shaderCompilerPath="/glsl_wgsl_compiler_bg.wasm"></ic-canvas>
    </div>
    <Flex justify="center" align="middle" style="margin-top: 16px">
      <Upload 
        name="file" 
        beforeUpload={handleUpload}
        accept=".svg"
        showUploadList={false}
      >
        <Button loading={loading.value}>
          <CloudUploadOutlined />
          {loading.value ? 'Loading...' : 'Upload SVG'}
        </Button>
      </Upload>
    </Flex>
  </div>);
};

defineRender(() => {
  return (
    <App>
      <Demo />
    </App>
  );
});
</script>
