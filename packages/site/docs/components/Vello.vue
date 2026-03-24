<script setup lang="ts">
import {
  App,
  Pen,
  DefaultPlugins,
  RendererPlugin,
  DefaultRendererPlugin,
  svgElementsToSerializedNodes,
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

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  onReady = async (e) => {
    api = e.detail;

    api.setAppState({
      cameraZoom: 0.5,
      cameraX: -400,
      penbarSelected: Pen.SELECT,
    });

    // Tiger SVG
    const res = await fetch('/Ghostscript_Tiger.svg');
    const svg = await res.text();
    const $container = document.createElement('div');
    $container.innerHTML = svg;
    const $svg = $container.children[0] as SVGSVGElement;
    const nodes = svgElementsToSerializedNodes(
      Array.from($svg.children) as SVGElement[],
    );
    nodes[0].x = 300;

    // Gradients
    const gradients = [
      {
        id: 'gradient-1',
        type: 'rect',
        fill: 'linear-gradient(to right, red, blue)',
        x: 300,
        y: 200,
        width: 100,
        height: 100,
        zIndex: 0,
      },
      {
        id: 'gradient-2',
        type: 'rect',
        fill: 'radial-gradient(circle at center, red, blue, green 100%)',
        x: 400,
        y: 200,
        width: 100,
        height: 100,
        zIndex: 0,
      },
      {
        id: 'gradient-3',
        type: 'rect',
        fill: 'conic-gradient(#eee, black, #eee)',
        x: 500,
        y: 200,
        width: 100,
        height: 100,
        zIndex: 0,
      },
      {
        id: 'gradient-4',
        type: 'rect',
        fill: `linear-gradient(217deg, rgba(255,0,0,.8), rgba(255,0,0,0) 70.71%)`,
        x: 600,
        y: 200,
        width: 200,
        height: 100,
        zIndex: 0,
      },
    ];

    const roughs = [
      {
        id: 'rough-1',
        type: 'rough-rect',
        fill: 'red',
        stroke: 'blue',
        strokeWidth: 1,
        x: 500,
        y: 100,
        width: 100,
        height: 100,
      },
      {
        id: 'rough-2',
        type: 'rough-ellipse',
        fill: 'red',
        stroke: 'blue',
        strokeWidth: 1,
        roughFillStyle: 'dots',
        roughHachureGap: 10,
        x: 600,
        y: 100,
        width: 100,
        height: 100,
      },
      {
        id: 'rough-3',
        type: 'rough-path',
        d: 'M 700 120 L 800 200 L 900 100 Z',
        fill: 'red',
        stroke: 'blue',
        strokeWidth: 1,
        roughFillStyle: 'cross-hatch',
        roughHachureGap: 10,
      },
    ];

    api.runAtNextTick(() => {
      api.updateNodes([
        ...nodes,
        ...gradients,
        ...roughs,
        {
          id: 'image-1',
          type: 'rect',
          fill: '/canvas.png',
          x: 500,
          y: 0,
          width: 100,
          height: 100,
          zIndex: 0,
        },
        {
          id: 'baseline-1',
          type: 'line',
          x1: 0,
          y1: 50,
          x2: 300,
          y2: 50,
          stroke: 'red',
          strokeWidth: 1,
          zIndex: 0,
        },
        {
          id: 'text-1',
          type: 'text',
          fill: 'black',
          content: 'Abcdefghijklmnop (top)',
          anchorX: 50,
          anchorY: 50,
          fontSize: 16,
          fontFamily: 'Noto Sans',
          textBaseline: 'top',
          zIndex: 1,
        },
        {
          id: 'baseline-2',
          type: 'line',
          x1: 0,
          y1: 100,
          x2: 300,
          y2: 100,
          stroke: 'red',
          strokeWidth: 1,
          zIndex: 3,
        },
        {
          id: 'text-2',
          type: 'text',
          fill: 'black',
          content: 'Abcdefghijklmnop (hanging)',
          anchorX: 50,
          anchorY: 100,
          fontSize: 16,
          fontFamily: 'sans-serif',
          textBaseline: 'hanging',
          zIndex: 4,
        },
        {
          id: 'baseline-3',
          type: 'line',
          x1: 0,
          y1: 150,
          x2: 300,
          y2: 150,
          stroke: 'red',
          strokeWidth: 1,
          zIndex: 5,
        },
        {
          id: 'text-3',
          type: 'text',
          fill: 'black',
          content: 'Abcdefghijklmnop (middle)',
          anchorX: 50,
          anchorY: 150,
          fontSize: 16,
          fontFamily: 'sans-serif',
          textBaseline: 'middle',
          zIndex: 6,
        },
        {
          id: 'baseline-4',
          type: 'line',
          x1: 0,
          y1: 200,
          x2: 300,
          y2: 200,
          stroke: 'red',
          strokeWidth: 1,
          zIndex: 5,
        },
        {
          id: 'text-4',
          type: 'text',
          fill: 'black',
          content: 'Abcdefghijklmnop (alphabetic)',
          anchorX: 50,
          anchorY: 200,
          fontSize: 16,
          fontFamily: 'sans-serif',
          textBaseline: 'alphabetic',
          zIndex: 6,
        },
        {
          id: 'baseline-5',
          type: 'line',
          x1: 0,
          y1: 250,
          x2: 300,
          y2: 250,
          stroke: 'red',
          strokeWidth: 1,
          zIndex: 5,
        },
        {
          id: 'text-5',
          type: 'text',
          fill: 'black',
          content: 'Abcdefghijklmnop (ideographic)',
          anchorX: 50,
          anchorY: 250,
          fontSize: 16,
          fontFamily: 'sans-serif',
          textBaseline: 'ideographic',
          zIndex: 6,
        },
        {
          id: 'baseline-6',
          type: 'line',
          x1: 0,
          y1: 300,
          x2: 300,
          y2: 300,
          stroke: 'red',
          strokeWidth: 1,
          zIndex: 5,
        },
        {
          id: 'text-6',
          type: 'text',
          fill: 'black',
          content: 'Abcdefghijklmnop (bottom)\nAbcdefghijklmnop ',
          anchorX: 50,
          anchorY: 300,
          fontSize: 16,
          fontFamily: 'sans-serif',
          textBaseline: 'bottom',
          zIndex: 6,
        },
      ]);
    });

    const mermaidGroup = {
      id: 'mermaid-group',
      type: 'g',
      x: -400,
      y: 0,
      zIndex: 0,
    };
    const mermaidNodes = await parseMermaidToSerializedNodes(`flowchart TD
 A[Christmas] -->|Get money| B(Go shopping)
 B --> C{Let me think}
 C -->|One| D[Laptop]
 C -->|Two| E[iPhone]
 C -->|Three| F[Car]`);
    mermaidNodes.forEach((node) => {
      if (node.type === 'rect') {
        // @ts-expect-error change type
        node.type = 'rough-rect';
      } else if (node.type === 'line') {
        // @ts-expect-error change type
        node.type = 'rough-line';
      } else if (node.type === 'polyline') {
        // @ts-expect-error change type
        node.type = 'rough-polyline';
      } else if (node.type === 'text') {
        node.fontFamily = 'Gaegu';
        node.stroke = 'white';
        node.strokeWidth = 4;
      } else if (node.type === 'path') {
        // @ts-expect-error change type
        node.type = 'rough-path';
      }

      if (!node.parentId) {
        node.parentId = mermaidGroup.id;
      }
    });
    import('webfontloader').then((module) => {
      const WebFont = module.default;
      WebFont.load({
        google: {
          families: ['Gaegu'],
        },
        active: () => {
          api.runAtNextTick(() => {
            api.updateNodes([mermaidGroup, ...mermaidNodes]);
          });
        },
      });
    });
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
    registerFont('/fonts/Gaegu-Regular.ttf');
    registerFont('/fonts/NotoSans-Regular.ttf');

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
</script>

<template>
  <ic-spectrum-canvas
    ref="wrapper"
    style="width: 100%; height: 400px"
  ></ic-spectrum-canvas>
</template>
