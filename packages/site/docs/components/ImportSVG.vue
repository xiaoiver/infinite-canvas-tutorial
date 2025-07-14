<script setup lang="tsx">
import { CloudUploadOutlined } from '@ant-design/icons-vue';
import { App, Button, Flex, Upload, message } from 'ant-design-vue';
import { ref, onMounted } from 'vue';
import { Canvas, Group, Path, deserializeNode, fromSVGElement, TesselationMethod } from '@infinite-canvas-tutorial/core';


defineOptions({ name: 'Import SVG' });

let canvas: Canvas | null = null;
let stats: any;

const wrapper = ref<HTMLDivElement | null>(null);
const loading = ref(false);

onMounted(() => {
  import('@infinite-canvas-tutorial/ui');

  const $canvas = wrapper.value;

  if (!$canvas) return;

  import('stats.js').then(m => {
    const Stats = m.default;
    stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';
    $canvas.parentElement?.appendChild($stats);
  });

  $canvas.addEventListener('ic-ready', (e) => {
    canvas = (e as any).detail;

    fetch(
      '/Ghostscript_Tiger.svg',
    ).then(async (res) => {
      const svg = await res.text();
      renderSVG(svg, 80, 80);
    });
  });

  $canvas.addEventListener('ic-frame', (e) => {
    stats?.update();
  });
});

const renderSVG = async (svg: string, x: number, y: number) => {
  const $container = document.createElement('div');
  $container.innerHTML = svg;
  const $svg = $container.children[0];

  const root = new Group();
  for (const child of $svg.children) {
    const group = await deserializeNode(fromSVGElement(child as SVGElement));
    group.children.forEach((path) => {
      (path as Path).tessellationMethod = TesselationMethod.LIBTESS;
      path.cullable = false;
    });

    root.appendChild(group);
  }

  canvas?.appendChild(root);

  root.position.x = x;
  root.position.y = y;
};

const handleUpload = (file: File) => {
  if (!canvas) {
    message.error('Canvas 未准备就绪');
    return false;
  }

  loading.value = true;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const svg = e.target?.result as string;
      await renderSVG(svg, 200, 80);
      message.success('SVG 加载成功');
    } catch (error) {
      console.error('处理 SVG 时出错:', error);
      message.error('SVG 处理失败');
    } finally {
      loading.value = false;
    }
  };

  reader.onerror = () => {
    message.error('文件读取失败');
    loading.value = false;
  };

  reader.readAsText(file);
  return false;
};

const Demo = () => {
  return (<div>
    <div style="position: relative">
      <ic-canvas ref={wrapper} style="height: 400px"></ic-canvas>
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