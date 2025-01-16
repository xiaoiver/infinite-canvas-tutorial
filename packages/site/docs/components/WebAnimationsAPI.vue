<script setup lang="tsx">
import { App } from 'ant-design-vue';
import { ref, onMounted } from 'vue';
import { Canvas, Rect } from '@infinite-canvas-tutorial/core';
import { animate } from "motion"

defineOptions({ name: 'Web Animations API' });

const wrapper = ref(null);
let canvas: Canvas | null = null;

onMounted(() => {
  const $canvas = wrapper.value;
  if (!$canvas) {
    return;
  }

  $canvas.addEventListener('ic-ready', async (e) => {
    canvas = (e as any).detail as Canvas;

    const rect = new Rect({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fill: 'red',
      batchable: false,
    });
    canvas.appendChild(rect);

    rect.pivot.x = 50;
    rect.pivot.y = 50;

    rect.position.x = 200;
    rect.position.y = 200;
    // console.log(parseTransform('rotate(45deg)'));

    // // await animate(rect.position, { x: 300 }, { duration: 5 });

    // @see https://motion.dev/docs/animate#transforms
    await animate(rect, { angle: 360 }, { duration: 2 });
    await animate(rect, { opacity: [0, 1] }, { duration: 1.5 });
    await animate(rect, { scaleX: [1, 0], scaleY: [1, 0] }, { duration: 1.5, repeat: Infinity, repeatType: "reverse", });
  });
});

const Demo = () => {
  return (<div>
    <div style="position: relative">
      <ic-canvas ref={wrapper} style="height: 400px"></ic-canvas>
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