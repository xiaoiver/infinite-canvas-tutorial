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
import { InitVello, VelloPipeline, registerFont } from '@infinite-canvas-tutorial/vello';

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
        }
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
        fontFamily: 'sans-serif',
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
    DefaultPlugins.splice(DefaultPlugins.indexOf(DefaultRendererPlugin), 1, VelloRendererPlugin);
    registerFont('/fonts/NotoSans-Regular.ttf');

    new App().addPlugins(...DefaultPlugins, UIPlugin, LaserPointerPlugin, LassoPlugin, EraserPlugin, YogaPlugin).run();
  } else {
    // 等待组件更新完成后检查API是否已经准备好
    setTimeout(() => {
      // 检查canvas的apiProvider是否已经有值
      const canvasElement = canvas as any;
      if (canvasElement.apiProvider?.value) {
        // 如果API已经准备好，手动触发onReady
        const readyEvent = new CustomEvent(Event.READY, {
          detail: canvasElement.apiProvider.value
        });
        onReady?.(readyEvent);
      } else {
        // 如果API还没准备好，监听API的变化
        let checkCount = 0;
        const checkInterval = setInterval(() => {
          checkCount++;
          if (canvasElement.apiProvider?.value) {
            clearInterval(checkInterval);
            const readyEvent = new CustomEvent(Event.READY, {
              detail: canvasElement.apiProvider.value
            });
            onReady?.(readyEvent);
          } else if (checkCount > 50) { // 5秒超时
            clearInterval(checkInterval);
            console.warn('Canvas API initialization timeout');
          }
        }, 100);
      }
    }, 100);
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
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 400px"></ic-spectrum-canvas>
</template>