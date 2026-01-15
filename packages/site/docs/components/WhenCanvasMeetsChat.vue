<script setup lang="ts">
import {
  App,
  Pen,
  DefaultPlugins,
  Task,
  CheckboardStyle,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { Event, UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { LaserPointerPlugin } from '@infinite-canvas-tutorial/laser-pointer';
import { LassoPlugin } from '@infinite-canvas-tutorial/lasso';
import { EraserPlugin } from '@infinite-canvas-tutorial/eraser';
import { ChatPlugin } from '@infinite-canvas-tutorial/chat';
import { FalAIPlugin } from '@infinite-canvas-tutorial/fal-ai';

const wrapper = ref<HTMLElement | null>(null);
let api: any | undefined;
let onReady: ((api: CustomEvent<any>) => void) | undefined;

onMounted(async () => {
  import('webfontloader').then((module) => {
    const WebFont = module.default;
    WebFont.load({
      google: {
        families: ['Gaegu'],
      },
    });
  });

  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  onReady = async (e) => {
    api = e.detail;

    const nodes = [
      {
        id: '1',
        name: 'A swimming dog',
        type: 'rect',
        fill: 'https://v3b.fal.media/files/b/tiger/v1lf1EcPP1X1pw_YOKM4o.jpg',
        x: 200,
        y: 150,
        width: 1024,
        height: 1024,
        lockAspectRatio: true,
      } as const,
      {
        id: '2',
        name: 'A swimming cat',
        type: 'rect',
        fill: 'https://v3b.fal.media/files/b/koala/0RQAsrw5rRX015XQUd4HX.jpg',
        x: 200 + 1200,
        y: 150,
        width: 1024,
        height: 1024,
        lockAspectRatio: true,
      } as const,
      {
        id: '3',
        name: 'A swimming dog without background',
        type: 'rect',
        fill: 'https://v3b.fal.media/files/b/panda/Xo61xntJdsl8_txn9WC-5.jpg',
        x: 200 + 2400,
        y: 150,
        width: 1024,
        height: 1024,
        lockAspectRatio: true,
      } as const,
      {
        id: '4',
        type: 'text',
        name: 'Enter your desired modifications in Chat.',
        fill: 'black',
        content: 'Enter your desired modifications in Chat.',
        fontSize: 66,
        fontFamily: 'Gaegu',
        anchorX: 200,
        anchorY: 100,
      } as const,
      {
        id: '5',
        type: 'text',
        name: 'Or select multiple images(😂 even my hand-drawn fish!) \nat once and combine them.',
        fill: 'black',
        content:
          'Or select multiple images(😂 even my hand-drawn fish!) \nat once and combine them.',
        fontSize: 66,
        fontFamily: 'Gaegu',
        anchorX: 200,
        anchorY: 1300,
      } as const,
      {
        id: '6',
        type: 'polyline',
        fill: 'none',
        points:
          '200,1676.46 228.35,1598.48 270.88,1531.14 295.69,1499.24 324.05,1474.43 359.49,1460.25 394.94,1453.16 437.47,1453.16 476.46,1460.25 511.90,1477.97 604.06,1555.95 703.30,1616.20 742.29,1619.75 760.01,1587.85 752.92,1552.40 752.92,1513.42 742.29,1470.88 724.57,1438.98 713.93,1400 682.03,1417.72 565.07,1573.67 504.81,1619.75 430.38,1655.19 355.95,1680 238.98,1683.55 224.81,1648.10 277.97,1594.94 313.42,1591.39 309.87,1626.84 274.43,1633.93 256.71,1602.03',
        stroke: '#147af3',
        strokeWidth: 18,
      } as const,
      {
        id: '7',
        type: 'rect',
        name: 'A dog with a hand-drawn fish',
        fill: 'https://v3.fal.media/files/penguin/9UH5Fgin7zc1u6NGGItGB.jpeg',
        x: 1400,
        y: 1400,
        width: 1408,
        height: 736,
      } as const,
      {
        id: '8',
        type: 'polyline',
        fill: 'none',
        points: '1100,1400 1215.69,1461.46 1324.16,1537.39',
        stroke: '#147af3',
        strokeWidth: 18,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        markerEnd: 'line',
      },
      {
        id: '9',
        type: 'text',
        name: 'Smart inpainting & outpainting are on the way.',
        fill: 'black',
        content:
          "Smart inpainting & outpainting are on the way.\nYou can easily select the tennis ball in dog's mouth and replace it with a golf ball.\nAlternatively, you can resize the image by dragging it and add more content inside.",
        fontSize: 66,
        fontFamily: 'Gaegu',
        anchorX: 200,
        anchorY: 2300,
      } as const,
    ];

    api.setAppState({
      cameraX: 0,
      cameraZoom: 0.35,
      // penbarSelected: Pen.VECTOR_NETWORK,
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.HAND, Pen.SELECT, Pen.DRAW_RECT, Pen.DRAW_ELLIPSE, Pen.DRAW_LINE, Pen.DRAW_ARROW, Pen.DRAW_ROUGH_RECT, Pen.DRAW_ROUGH_ELLIPSE, Pen.IMAGE, Pen.TEXT, Pen.PENCIL, Pen.BRUSH, Pen.ERASER, Pen.LASER_POINTER],
      penbarText: {
        ...api.getAppState().penbarText,
        fontFamily: 'system-ui',
        fontFamilies: ['system-ui', 'serif', 'monospace', 'Gaegu'],
      },
      taskbarAll: [
        Task.SHOW_CHAT_PANEL,
        Task.SHOW_LAYERS_PANEL,
        Task.SHOW_PROPERTIES_PANEL,
      ],
      taskbarSelected: [Task.SHOW_CHAT_PANEL, Task.SHOW_LAYERS_PANEL],
      taskbarChatMessages: [
        {
          role: 'user',
          content:
            "An action shot of a black lab swimming in an inground suburban swimming pool. The camera is placed meticulously on the water line, dividing the image in half, revealing both the dogs head above water holding a tennis ball in it's mouth, and it's paws paddling underwater.",
        },
        {
          role: 'assistant',
          content: 'Sure! Here is your image:',
          images: [
            {
              url: 'https://v3b.fal.media/files/b/tiger/v1lf1EcPP1X1pw_YOKM4o.jpg',
            },
          ],
          suggestions: [
            {
              text: 'Replace the puppy with a kitten.',
            },
            {
              text: 'Remove the background.',
            },
          ],
        },
      ],
      checkboardStyle: CheckboardStyle.GRID,
      snapToPixelGridEnabled: true,
      snapToPixelGridSize: 10,
      snapToObjectsEnabled: true,
      snapToObjectsDistance: 8,
      // checkboardStyle: CheckboardStyle.NONE,
      // penbarSelected: Pen.SELECT,
      // topbarVisible: false,
      // contextBarVisible: false,
      // penbarVisible: false,
      // taskbarVisible: false,
      // rotateEnabled: false,
      // flipEnabled: false,
    });

    api.updateNodes(nodes);
    api.selectNodes([nodes[0]]);

    api.record();
  };

  canvas.addEventListener(Event.READY, onReady);

  // App only runs once
  if (!(window as any).worldInited) {
    (window as any).worldInited = true;
    await import('@infinite-canvas-tutorial/webcomponents/spectrum');
    await import('@infinite-canvas-tutorial/lasso/spectrum');
    await import('@infinite-canvas-tutorial/eraser/spectrum');
    await import('@infinite-canvas-tutorial/laser-pointer/spectrum');
    await import('@infinite-canvas-tutorial/chat/spectrum');
    new App().addPlugins(...DefaultPlugins, UIPlugin, LaserPointerPlugin, LassoPlugin, EraserPlugin, ChatPlugin, FalAIPlugin.configure({
      credentials: 'your-fal-ai-credentials-here',
    })).run();
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
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 900px">
    <ic-spectrum-penbar-laser-pointer slot="penbar-item" />
    <!-- <ic-spectrum-penbar-lasso slot="penbar-item" /> -->
    <ic-spectrum-penbar-eraser slot="penbar-item" />
    <ic-spectrum-taskbar-chat slot="taskbar-item" />
    <ic-spectrum-taskbar-chat-panel slot="taskbar-panel" />
  </ic-spectrum-canvas>
</template>