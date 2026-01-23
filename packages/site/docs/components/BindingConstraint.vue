<script setup lang="ts">
import {
  App,
  Pen,
  DefaultPlugins,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { Event, UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { LaserPointerPlugin } from '@infinite-canvas-tutorial/laser-pointer';
import { LassoPlugin } from '@infinite-canvas-tutorial/lasso';
import { EraserPlugin } from '@infinite-canvas-tutorial/eraser';

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
      ...api.getAppState(),
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT, Pen.HAND],
    });

    const node1 = {
      id: 'rect-1',
      type: 'rect',
      x: 100,
      y: 0,
      width: 100,
      height: 100,
      fill: 'grey',
      constraints: [
        {
          x: 1,
          y: 0,
        },
      ],
    };
    const node2 = {
      id: 'rect-2',
      type: 'rect',
      x: 300,
      y: 0,
      width: 100,
      height: 100,
      fill: 'red',
    };
    const node3 = {
      id: 'rect-3',
      type: 'rect',
      x: 400,
      y: 150,
      width: 100,
      height: 100,
      fill: 'green',
      constraints: [
        {
          x: 0,
          y: 1,
        },
      ],
    };
    const edge1 = {
      id: 'line-1',
      type: 'line',
      fromId: 'rect-1',
      toId: 'rect-2',
      stroke: 'black',
      strokeWidth: 10,
      markerEnd: 'line',
      exitX: 1,
      exitY: 0,
    };
    const edge2 = {
      id: 'line-2',
      type: 'line',
      fromId: 'rect-2',
      toId: 'rect-3',
      stroke: 'black',
      strokeWidth: 10,
      markerEnd: 'line',
      entryX: 0,
      entryY: 1,
    };

    api.updateNodes([
      node1, node2, node3, edge1, edge2,
    ]);
  };

  canvas.addEventListener(Event.READY, onReady);

  // App only runs once
  if (!(window as any).worldInited) {
    (window as any).worldInited = true;
    await import('@infinite-canvas-tutorial/webcomponents/spectrum');
    await import('@infinite-canvas-tutorial/lasso/spectrum');
    await import('@infinite-canvas-tutorial/eraser/spectrum');
    await import('@infinite-canvas-tutorial/laser-pointer/spectrum');
    new App().addPlugins(...DefaultPlugins, UIPlugin, LaserPointerPlugin, LassoPlugin, EraserPlugin).run();
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
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 300px"></ic-spectrum-canvas>
</template>