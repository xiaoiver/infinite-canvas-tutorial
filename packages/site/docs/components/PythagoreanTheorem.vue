<script setup lang="tsx">
import { App, Flex } from 'ant-design-vue';
import { Sender, Prompts, type PromptsProps } from 'ant-design-x-vue';
import { BulbOutlined } from '@ant-design/icons-vue';
import { ref, onMounted } from 'vue';
import { Canvas, Group, Text, deserializeNode, parseTransform } from '@infinite-canvas-tutorial/core';
import { animate } from "motion";
import Anthropic from '@anthropic-ai/sdk';

const items: PromptsProps['items'] = [
  {
    key: '0',
    icon: <BulbOutlined style={{ color: '#964B00' }} />,
    description: 'How to prove the Pythagorean Theorem using geometric methods?',
    disabled: false,
  },
];

function sleep(s: number) {
  return new Promise(resolve => setTimeout(resolve, s * 1000));
}

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

defineOptions({ name: 'PythagoreanTheorem' });

const wrapper = ref<HTMLDivElement | null>(null);
let canvas: Canvas | null = null;
const layer = new Group();

onMounted(() => {
  const $canvas = wrapper.value;
  if (!$canvas) {
    return;
  }

  import('webfontloader').then((module) => {
    const WebFont = module.default;
    WebFont.load({
      google: {
        families: ['Gaegu'],
      },
    });
  });

  $canvas.addEventListener('ic-ready', async (e) => {
    canvas = (e as any).detail as Canvas;

    canvas?.appendChild(layer);
    const camera = canvas.camera;

    const landmark = camera.createLandmark({
      x: -200,
      y: -200,
      zoom: 1,
      rotation: 0,
    });
    camera.gotoLandmark(landmark, {
      duration: 0,
      easing: 'ease',
    });
  });
});

const Demo = () => {
  const value = ref('');
  const loading = ref<boolean>(false);

  const { message } = App.useApp();

  const handleSendUserMessage = async (userMessage: string) => {
    loading.value = true;

    layer.children.forEach((child) => {
      layer?.removeChild(child);
    });

    // TODO: Let user provide their own Anthropic API key
    // const anthropic = new Anthropic({
    //   apiKey: 'my_api_key', // defaults to process.env["ANTHROPIC_API_KEY"]
    // });

    // const msg = await anthropic.messages.create({
    //   model: "claude-3-5-sonnet-20241022",
    //   max_tokens: 1024,
    //   messages: [{ role: "user", content: userMessage }],
    // });

    // Use mock data for now
    const data = await (await fetch('/animations/pythagorean-theorem.json')).json();
    loading.value = false;

    const graphicsMap = new Map<string, any>();

    const name = new Text({
      x: 0,
      y: -100,
      content: 'Pythagorean Theorem',
      fontSize: 24,
      fontFamily: 'Gaegu',
      fill: 'black',
      esdt: false
    });
    layer.appendChild(name);

    const description = new Text({
      x: 0,
      y: -70,
      content: data.description,
      fontSize: 20,
      fontFamily: 'Gaegu',
      fill: 'black',
      esdt: false
    });
    layer.appendChild(description);

    let previousCaption: Text | null = null;
    for (const { title, graphics, animations } of data.steps) {
      if (previousCaption) {
        await animate(previousCaption, {
          opacity: [1, 0]
        }, {
          duration: 1,
          ease: 'easeOut'
        });
      }

      const caption = new Text({
        x: 0,
        y: -20,
        content: title,
        fontFamily: 'Gaegu',
        fontSize: 16,
        fill: 'black',
        esdt: false
      });
      layer.appendChild(caption);
      previousCaption = caption;
      await animate(caption, {
        opacity: [0, 1]
      }, {
        duration: 1,
        ease: 'easeIn'
      });

      const root = new Group();
      for (const graphic of graphics) {
        if (graphic.type === 'rect') {
          graphic.type = 'rough-rect';
          graphic.roughness = 3;
        }

        const node = await deserializeNode(graphic);
        node.batchable = false;
        node.cullable = false;
        node.fontFamily = 'Gaegu';

        graphicsMap.set(graphic.id, node);
        layer.appendChild(node);
      }
      layer.appendChild(root);

      for (const animation of animations) {
        const { target, keyframes, options } = convertAnimationToMotion(animation);
        const node = graphicsMap.get(target.replace('#', ''));

        await animate(node, keyframes, options);
        await sleep(1);
      }
    }
  }

  return (<div>
    <div style="position: relative">
      <ic-canvas ref={wrapper} style="height: 400px"></ic-canvas>
    </div>
    <Flex vertical gap="middle">
      <Prompts title="🤔 You might also want to ask:" style="margin-top: 16px" items={items} vertical onItemClick={(v) => handleSendUserMessage(v.data.description)}/>
      <Sender
        loading={loading.value}
        value={value.value}
        onChange={(v) => {
          value.value = v;
        }}
        onSubmit={() => {
          handleSendUserMessage(value.value);
          value.value = '';
          loading.value = true
        }}
        onCancel={() => {
          loading.value = false
        }}
      />
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