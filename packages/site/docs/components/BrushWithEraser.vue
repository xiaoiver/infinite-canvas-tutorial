<script setup lang="ts">
import {
  App,
  Pen,
  DefaultPlugins,
  BrushType,
  inferXYWidthHeight,
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
      cameraX: -100,
      cameraY: 100,
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT, Pen.BRUSH],
    });

    // Generate sinewave geometry
    const maxRadius = (1 / 3) * 100;
    const segmentCount = 32;

    const position: [number, number][] = [];
    const radius: number[] = [];

    const gr = (1 + Math.sqrt(5)) / 2; // golden ratio
    const pi = Math.PI;

    for (let i = 0; i <= segmentCount; ++i) {
      let a = i / segmentCount;
      let x = -pi + 2 * pi * a;
      let y = Math.sin(x) / gr;
      let r = Math.cos(x / 2.0) * maxRadius;

      position.push([x * 100 + 360, y * 100 + 120]);
      radius.push(r);
    }

    const clipParent = {
      id: 'brush-with-eraser-1',
      type: 'path',
      clipMode: 'erase',
      // vertical stripes, width 100, height 200, gap 50
      d: 'M 0 0 L 50 0 L 50 200 L 0 200 Z M 100 0 L 150 0 L 150 200 L 100 200 Z M 200 0 L 250 0 L 250 200 L 200 200 Z',
      fill: 'none',
    };

    const node = {
      id: 'brush-with-eraser-2',
      type: 'brush',
      parentId: 'brush-with-eraser-1',
      // brushType: BrushType.VANILLA,
      brushType: BrushType.STAMP,
      brushStamp: '/stamp1.png',
      stampInterval: 0.4,
      // brushStamp: '/brush.jpg',
      points: position.map(([x, y], i) => `${x - 200},${y + 20},${radius[i]}`).join(' '),
      stroke: 'red',
      strokeWidth: 10,
      strokeOpacity: 1,
    };

    inferXYWidthHeight(node);
    inferXYWidthHeight(clipParent);

    api.updateNodes([
      clipParent, node,
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