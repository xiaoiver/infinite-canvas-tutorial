<script setup lang="ts">
import {
  App,
  Pen,
  Task,
  DefaultPlugins,
  svgElementsToSerializedNodes,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { Event, UIPlugin } from '@infinite-canvas-tutorial/webcomponents';

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

  const res = await fetch('/maslow-hierarchy.svg');
  const svg = await res.text();
  // TODO: extract semantic groups inside comments
  const $container = document.createElement('div');
  $container.innerHTML = svg;
  const $svg = $container.children[0] as SVGSVGElement;

  const nodes = svgElementsToSerializedNodes(
    Array.from($svg.children) as SVGElement[],
  );

  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  onReady = async (e) => {
    api = e.detail;

    api.runAtNextTick(() => {
      api.setAppState({
        penbarSelected: Pen.SELECT,
        taskbarSelected: [Task.SHOW_LAYERS_PANEL],
        penbarText: {
          fontFamilies: ['system-ui', 'serif', 'monospace', 'Gaegu'],
        },
      });

      api.updateNodes(nodes);
      api.selectNodes([nodes[0]]);

      api.record();
    });
  };

  canvas.addEventListener(Event.READY, onReady);

  // App only runs once
  if (!(window as any).worldInited) {
    (window as any).worldInited = true;
    await import('@infinite-canvas-tutorial/webcomponents/spectrum');
    new App().addPlugins(...DefaultPlugins, UIPlugin).run();
  } else {
    // 当App已经初始化时，需要等待canvas组件准备好并检查API
    await import('@infinite-canvas-tutorial/webcomponents/spectrum');

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
  <div>
    <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 600px"></ic-spectrum-canvas>
  </div>
</template>