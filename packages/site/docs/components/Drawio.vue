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
import { parseMxgraphDataToSerializedNodes } from '@infinite-canvas-tutorial/drawio';

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
      penbarAll: [Pen.SELECT],
    });

    const nodes = await parseMxgraphDataToSerializedNodes(`<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="2" customId="2" value="&lt;img src=&quot;editors/images/overlays/user3.png&quot;&gt;&lt;br&gt;&lt;b&gt;Last, First&lt;/b&gt;&lt;br&gt;Status&lt;br&gt;Info" vertex="1" parent="1">
      <mxGeometry x="0" y="0" width="80" height="70" as="geometry"/>
    </mxCell>
    <mxCell id="3" customId="3" value="&lt;img src=&quot;editors/images/overlays/error.png&quot;&gt;&lt;br&gt;&lt;b&gt;Errorcode&lt;/b&gt;&lt;br&gt;Status&lt;br&gt;Info" vertex="1" parent="1">
      <mxGeometry x="0" y="0" width="80" height="70" as="geometry"/>
    </mxCell>
    <mxCell id="4" customId="4" value="&lt;img src=&quot;editors/images/overlays/flash.png&quot;&gt;&lt;br&gt;&lt;b&gt;Warning&lt;/b&gt;&lt;br&gt;Status&lt;br&gt;Info" vertex="1" parent="1">
      <mxGeometry x="0" y="0" width="120" height="70" as="geometry"/>
    </mxCell>
    <mxCell id="5" customId="5" value="&lt;img src=&quot;editors/images/overlays/users3.png&quot;&gt;&lt;br&gt;&lt;b&gt;Groupname&lt;/b&gt;&lt;br&gt;Status&lt;br&gt;Info" vertex="1" parent="1">
      <mxGeometry x="0" y="0" width="80" height="70" as="geometry"/>
    </mxCell>
    <mxCell id="6" customId="6" value="&lt;img src=&quot;editors/images/overlays/workplace.png&quot;&gt;&lt;br&gt;&lt;b&gt;Workplace&lt;/b&gt;&lt;br&gt;Status&lt;br&gt;Info" vertex="1" parent="1">
      <mxGeometry x="0" y="0" width="80" height="70" as="geometry"/>
    </mxCell>
    <mxCell id="7" customId="6" value="&lt;img src=&quot;editors/images/overlays/information.png&quot;&gt;&lt;br&gt;&lt;b&gt;Information&lt;/b&gt;&lt;br&gt;Status&lt;br&gt;Info" vertex="1" parent="1">
      <mxGeometry x="0" y="0" width="80" height="70" as="geometry"/>
    </mxCell>
    <mxCell id="8" customId="7" value="&lt;img src=&quot;editors/images/overlays/printer.png&quot;&gt;&lt;br&gt;&lt;b&gt;Printername&lt;/b&gt;&lt;br&gt;Status&lt;br&gt;Info" vertex="1" parent="1">
      <mxGeometry x="0" y="0" width="120" height="70" as="geometry"/>
    </mxCell>
    <mxCell id="edge-1" customId="edge-1" value="&lt;img src=&quot;editors/images/overlays/lightbulb_on.png&quot;&gt; Hint" edge="1" parent="1" source="2" target="3">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>
    <mxCell id="edge-2" customId="edge-2" value="&lt;img src=&quot;editors/images/overlays/help.png&quot;&gt; News" edge="1" parent="1" source="2" target="4">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>
    <mxCell id="edge-3" customId="edge-3" value="&lt;img src=&quot;editors/images/overlays/information.png&quot;&gt; Member" edge="1" parent="1" source="2" target="5">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>
    <mxCell id="edge-4" customId="edge-4" value="&lt;img src=&quot;editors/images/overlays/pencil.png&quot;&gt; Details" edge="1" parent="1" source="6" target="7">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>
    <mxCell id="edge-5" customId="edge-5" value="&lt;img src=&quot;editors/images/overlays/check.png&quot;&gt; Access" edge="1" parent="1" source="6" target="8">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>
    <mxCell id="edge-6" customId="edge-6" value="&lt;img src=&quot;editors/images/overlays/forbidden.png&quot;&gt; Access" edge="1" parent="1" source="5" target="6">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>
    <mxCell id="edge-7" customId="edge-7" value="&lt;img src=&quot;editors/images/overlays/lightbulb_on.png&quot;&gt; 2-Way" style="2way" edge="1" parent="1" source="2" target="6">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>
  </root>
</mxGraphModel>`);

console.log(nodes);

    // api.runAtNextTick(() => {
    //   api.updateNodes(nodes);
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
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 300px"
    app-state='{"topbarVisible":true, "cameraZoom": 0.6, "cameraX": -500, "cameraY": -100}'>
  </ic-spectrum-canvas>
</template>