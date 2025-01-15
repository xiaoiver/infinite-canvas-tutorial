<script setup lang="tsx">
import { App } from 'ant-design-vue';
import { ref, onMounted } from 'vue';
import { Group, deserializeNode, fromSVGElement, TesselationMethod } from '@infinite-canvas-tutorial/core';

defineOptions({ name: 'WebGPU' });

const wrapper = ref(null);
let canvas = null;

const renderSVG = async (svg: string, x: number, y: number) => {
  const $container = document.createElement('div');
  $container.innerHTML = svg;
  const $svg = $container.children[0];
  
  const root = new Group();
  for (const child of $svg.children) {
    const group = await deserializeNode(fromSVGElement(child));
    group.children.forEach((path) => {
        path.tessellationMethod = TesselationMethod.LIBTESS;
        path.cullable = false;
    });
   
    root.appendChild(group);
  }

  canvas.appendChild(root);

  root.position.x = x;
  root.position.y = y;
};

onMounted(() => {
  const $canvas = wrapper.value;
  if (!$canvas) {
    return;
  }

  $canvas.addEventListener('ic-ready', (e) => {
    canvas = e.detail;

    window.fetch(
        '/Ghostscript_Tiger.svg',
    ).then(async (res) => {
        const svg = await res.text();
        renderSVG(svg, 80, 80);
    });
  });
});

const Demo = () => {
  return (<div>
    <div style="position: relative">
      <ic-canvas renderer="webgpu" ref={wrapper} style="height: 400px"></ic-canvas>
    </div>
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