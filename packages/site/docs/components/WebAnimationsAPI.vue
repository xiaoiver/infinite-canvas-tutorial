<script setup lang="tsx">
import { App } from 'ant-design-vue';
import { ref, onMounted } from 'vue';
import { Canvas, Rect, parseTransform } from '@infinite-canvas-tutorial/core';
import { animate } from "motion"

function convertAnimationToMotion(animation: any) {
  const { target, keyframes, options } = animation;

  const keyframesMap = {};
  keyframes.forEach((frame: any) => {
    Object.keys(frame).forEach((key) => {
      if (key === 'transform') {
        const parsed = parseTransform(frame[key]);
        const { position: { x: tx, y: ty }, scale: { x: sx, y: sy }, rotation, skew: { x: kx, y: ky } } = parsed;

        if (!keyframesMap['translateX']) {
          keyframesMap['translateX'] = [];
        }
        keyframesMap['translateX'].push(tx);

        if (!keyframesMap['translateY']) {
          keyframesMap['translateY'] = [];
        }
        keyframesMap['translateY'].push(ty);

        if (!keyframesMap['scaleX']) {
          keyframesMap['scaleX'] = [];
        }
        keyframesMap['scaleX'].push(sx);

        if (!keyframesMap['scaleY']) {
          keyframesMap['scaleY'] = [];
        }
        keyframesMap['scaleY'].push(sy);

        if (!keyframesMap['angle']) {
          keyframesMap['angle'] = [];
        }
        keyframesMap['angle'].push(rotation);

        if (!keyframesMap['skewX']) {
          keyframesMap['skewX'] = [];
        }
        keyframesMap['skewX'].push(kx);

        if (!keyframesMap['skewY']) {
          keyframesMap['skewY'] = [];
        }
        keyframesMap['skewY'].push(ky);
      } else if (key === 'transform-origin') {
        // TODO:
      } else {
        if (!keyframesMap[key]) {
          keyframesMap[key] = [];
        }
        keyframesMap[key].push(frame[key]);
      }
    });
  });

  // motion use seconds instead of milliseconds
  options.duration = options.duration / 1000;

  return {
    target,
    keyframes: keyframesMap,
    options,
  };
}

defineOptions({ name: 'Web Animations API' });

const wrapper = ref<HTMLDivElement | null>(null);
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
    // await animate(rect, { angle: 360 }, { duration: 2 });
    // await animate(rect, { opacity: [0, 1] }, { duration: 1.5 });
    // await animate(rect, { scaleX: [1, 0], scaleY: [1, 0] }, { duration: 1.5, repeat: Infinity, repeatType: "reverse", });

    const animation = {
        "target": "#squareA",
        "keyframes": [
            {
                "transform": "scale(0,0)",
                fill: "red"
            },
            {
                "transform": "scale(1,1)",
                fill: 'blue'
            }
        ],
        "options": {
            "duration": 1000,
            "easing": "ease-out"
        }
    };

    console.log(convertAnimationToMotion(animation));
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