<script setup lang="ts">
import {
  App,
  Pen,
  DefaultPlugins,
  RendererPlugin,
  DefaultRendererPlugin,
  CheckboardStyle,
  ThemeMode,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { Event, UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { LaserPointerPlugin } from '@infinite-canvas-tutorial/laser-pointer';
import { LassoPlugin } from '@infinite-canvas-tutorial/lasso';
import { EraserPlugin } from '@infinite-canvas-tutorial/eraser';
import { YogaPlugin } from '@infinite-canvas-tutorial/yoga';
import {
  InitVello,
  VelloPipeline,
  registerFont,
} from '@infinite-canvas-tutorial/vello';
import { parseMermaidToSerializedNodes } from '@infinite-canvas-tutorial/mermaid';

const wrapper = ref<HTMLElement | null>(null);
let api: any | undefined;
let onReady: ((api: CustomEvent<any>) => void) | undefined;
const giStrength = ref(0.1);

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  onReady = async (e) => {
    api = e.detail;

    api.setAppState({
      ...api.getAppState(),
      cameraZoom: 0.53,
      cameraX: -300,
      cameraY: -100,
      penbarSelected: Pen.SELECT,
      checkboardStyle: CheckboardStyle.NONE,
      themeMode: ThemeMode.DARK,
      penbarDrawRect: {
        ...api.getAppState().penbarDrawRect,
        fill: 'yellow',
        fillOpacity: 1,
        strokeWidth: 0,
      },
      penbarDrawEllipse: {
        ...api.getAppState().penbarDrawEllipse,
        fill: 'yellow',
        fillOpacity: 1,
        strokeWidth: 0,
      },
      penbarDrawLine: {
        ...api.getAppState().penbarDrawLine,
        stroke: 'blue',
        strokeWidth: 6,
      },
      giEnabled: true,
      giStrength: 0.1,
    });

    const node1 = {
      id: 'radiance-rect-1',
      type: 'rect',
      x: 500,
      y: 120,
      width: 100,
      height: 100,
      fill: 'black',
    };
    const node2 = {
      id: 'radiance-rect-2',
      type: 'ellipse',
      x: -100,
      y: 0,
      width: 100,
      height: 100,
      fill: 'red',
    };
    const node3 = {
      id: 'radiance-rect-3',
      type: 'rect',
      x: 600,
      y: 550,
      width: 100,
      height: 200,
      rotation: Math.PI / 6,
      fill: 'green',
    };

    const line = {
      id: 'radiance-line-3',
      type: 'line',
      x1: -100,
      y1: 500,
      x2: 0,
      y2: 700,
      stroke: 'grey',
      strokeWidth: 10,
    };

    const polyline = {
      id: 'radiance-polyline-1',
      type: 'polyline',
      points: '400,100 500,200 600,100',
      stroke: 'grey',
      strokeWidth: 4,
      rotation: -Math.PI / 1.5,
    };

    api.updateNodes([
      node1, node2, node3,
      line, polyline,
    ]);

    const nodes = await parseMermaidToSerializedNodes(`flowchart TD
 A[Christmas] -->|Get money| B(Go shopping)
 B --> C{Let me think}
 C -->|One| D[Laptop]
 C -->|Two| E[iPhone]
 C -->|Three| F[Car]`);
    nodes.forEach(node => {
      if (node.type === 'rect') {
        node.fill = 'black';
        node.strokeWidth = 0;
      } else if (node.type === 'line') {
        node.stroke = '#454343';
      } else if (node.type === 'polyline') {
        node.stroke = '#454343';
      } else if (node.type === 'text') {
        node.fontFamily = 'Gaegu';
        node.fill = 'white';
        node.stroke = 'none';
      } else if (node.type === 'path') {
        node.fill = '#454343';
        node.strokeWidth = 0;
      }
    });
    // import('webfontloader').then((module) => {
    //   const WebFont = module.default;
    //   WebFont.load({
    //     google: {
    //       families: ['Gaegu'],
    //     },
    //     active: () => {
    api.runAtNextTick(() => {
      api.updateNodes(nodes);
    });
    //     }
    //   });
    // });
  };

  canvas.addEventListener(Event.READY, onReady);

  // App only runs once
  if (!(window as any).worldInited) {
    (window as any).worldInited = true;
    await import('@infinite-canvas-tutorial/webcomponents/spectrum');
    await import('@infinite-canvas-tutorial/lasso/spectrum');
    await import('@infinite-canvas-tutorial/eraser/spectrum');
    await import('@infinite-canvas-tutorial/laser-pointer/spectrum');

    const VelloRendererPlugin = RendererPlugin.configure({
      setupDeviceSystemCtor: InitVello,
      rendererSystemCtor: VelloPipeline,
    });
    DefaultPlugins.splice(
      DefaultPlugins.indexOf(DefaultRendererPlugin),
      1,
      VelloRendererPlugin,
    );
    registerFont('/fonts/NotoSans-Regular.ttf');
    registerFont('/fonts/Gaegu-Regular.ttf');

    new App()
      .addPlugins(
        ...DefaultPlugins,
        UIPlugin,
        LaserPointerPlugin,
        LassoPlugin,
        EraserPlugin,
        YogaPlugin,
      )
      .run();
  }
});

onUnmounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  if (onReady) {
    canvas.removeEventListener(Event.READY, onReady);
  }

  api?.destroy();
});

const onGiStrengthChange = (e: CustomEvent<number>) => {
  if (!api) {
    return;
  }

  const giStrength = parseFloat((e.target as HTMLInputElement).value);
  api.setAppState({
    giStrength,
  });
};
</script>

<template>
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 500px"></ic-spectrum-canvas>
  <label for="giStrength">GI Strength: {{ giStrength }}</label>
  <input id="giStrength" type="range" min="0" max="0.2" step="0.01" v-model="giStrength" @input="onGiStrengthChange" />
</template>