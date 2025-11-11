<script setup lang="ts">
import {
  App,
  Pen,
  DefaultPlugins,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { Event, UIPlugin } from '@infinite-canvas-tutorial/webcomponents';

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
      cameraZoom: 0.5,
      penbarSelected: Pen.SELECT,
      penbarVisible: false,
      taskbarVisible: false,
    });

    const node = {
      id: 'html-1',
      type: 'html',
      x: 100,
      y: 100,
      width: 491,
      height: 288,
      html: `<meta charset='utf- 8'><div style="color: #e4e4e4;background-color: #181818;font-family: Menlo, Monaco, 'Courier New', monospace;font-weight: normal;font-size: 12px;line-height: 18px;white-space: pre;"><div><span style="color: #82d2ce;">import</span><span style="color: #e4e4e4;"> { </span><span style="color: #87c3ff;">field</span><span style="color: #e4e4e4;">, </span><span style="color: #87c3ff;">Entity</span><span style="color: #e4e4e4;">, </span><span style="color: #87c3ff;">Type</span><span style="color: #e4e4e4;"> } </span><span style="color: #82d2ce;">from</span><span style="color: #e4e4e4;"> </span><span style="color: #e394dc;">'@lastolivegames / becsy'</span><span style="color: #e4e4e4;">;</span></div><div><span style="color: #82d2ce;">import</span><span style="color: #e4e4e4;"> { </span><span style="color: #87c3ff;">BitmapFont</span><span style="color: #e4e4e4;"> } </span><span style="color: #82d2ce;">from</span><span style="color: #e4e4e4;"> </span><span style="color: #e394dc;">'../ utils / bitmap - font / BitmapFont'</span><span style="color: #e4e4e4;">;</span></div><br><div><span style="color: #82d2ce;">export</span><span style="color: #e4e4e4;"> </span><span style="color: #82d2ce;">class</span><span style="color: #e4e4e4;"> </span><span style="color: #87c3ff;">Font</span><span style="color: #e4e4e4;"> {</span></div><div><span style="color: #e4e4e4;">  @</span><span style="color: #ebc88d;">field</span><span style="color: #e4e4e4;">.</span><span style="color: #ebc88d;">ref</span><span style="color: #e4e4e4;"> </span><span style="color: #82d2ce;">declare</span><span style="color: #e4e4e4;"> </span><span style="color: #aaa0fa;">canvas</span><span style="color: #d6d6dd;">:</span><span style="color: #e4e4e4;"> </span><span style="color: #efb080;">Entity</span><span style="color: #e4e4e4;">;</span></div><br><div><span style="color: #e4e4e4;">  @</span><span style="color: #ebc88d;">field</span><span style="color: #e4e4e4;">({ </span><span style="color: #aaa0fa;">type</span><span style="color: #d6d6dd;">:</span><span style="color: #e4e4e4;"> </span><span style="color: #87c3ff;">Type</span><span style="color: #e4e4e4;">.</span><span style="color: #efb080;">staticString</span><span style="color: #e4e4e4;">(</span><span style="color: #d6d6dd;">[</span><span style="color: #e394dc;">'bitmap'</span><span style="color: #d6d6dd;">]</span><span style="color: #e4e4e4;">), </span><span style="color: #aaa0fa;">default</span><span style="color: #d6d6dd;">:</span><span style="color: #e4e4e4;"> </span><span style="color: #e394dc;">'bitmap'</span><span style="color: #e4e4e4;"> })</span></div><div><span style="color: #e4e4e4;">  </span><span style="color: #82d2ce;">declare</span><span style="color: #e4e4e4;"> </span><span style="color: #aaa0fa;">type</span><span style="color: #d6d6dd;">:</span><span style="color: #e4e4e4;"> </span><span style="color: #e394dc;">'bitmap'</span><span style="color: #e4e4e4;">;</span></div><br><div><span style="color: #e4e4e4;">  @</span><span style="color: #ebc88d;">field</span><span style="color: #e4e4e4;">.</span><span style="color: #ebc88d;">object</span><span style="color: #e4e4e4;"> </span><span style="color: #82d2ce;">declare</span><span style="color: #e4e4e4;"> </span><span style="color: #aaa0fa;">bitmapFont</span><span style="color: #d6d6dd;">:</span><span style="color: #e4e4e4;"> </span><span style="color: #87c3ff;">BitmapFont</span><span style="color: #e4e4e4;">;</span></div><br><div><span style="color: #e4e4e4;">  </span><span style="color: #82d2ce;">constructor</span><span style="color: #e4e4e4;">(</span><span style="color: #d6d6dd;font-style: italic;">font</span><span style="color: #82d2ce;">?</span><span style="color: #d6d6dd;">:</span><span style="color: #e4e4e4;"> </span><span style="color: #efb080;">Partial</span><span style="color: #e4e4e4;">&lt;</span><span style="color: #87c3ff;">Font</span><span style="color: #e4e4e4;">&gt;) {</span></div><div><span style="color: #e4e4e4;">    </span><span style="color: #87c3ff;">Object</span><span style="color: #e4e4e4;">.</span><span style="color: #efb080;">assign</span><span style="color: #e4e4e4;">(</span><span style="color: #cc7c8a;">this</span><span style="color: #e4e4e4;">, </span><span style="color: #d6d6dd;font-style: italic;">font</span><span style="color: #e4e4e4;">);</span></div><div><span style="color: #e4e4e4;">  }</span></div><div><span style="color: #e4e4e4;">}</span></div><br></div>`,
    };
    api.updateNode(node);

    api.selectNodes([node]);
  };

  canvas.addEventListener(Event.READY, onReady);

  // App only runs once
  if (!(window as any).worldInited) {
    (window as any).worldInited = true;
    await import('@infinite-canvas-tutorial/webcomponents/spectrum');
    new App().addPlugins(...DefaultPlugins, UIPlugin).run();
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