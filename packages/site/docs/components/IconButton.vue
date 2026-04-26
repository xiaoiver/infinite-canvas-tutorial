<script setup lang="ts">
import {
  App,
  Pen,
  DefaultPlugins,
  Task,
  registerIconifyIconSet,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { Event, UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { LaserPointerPlugin } from '@infinite-canvas-tutorial/laser-pointer';
import { LassoPlugin } from '@infinite-canvas-tutorial/lasso';
import { EraserPlugin } from '@infinite-canvas-tutorial/eraser';
import { YogaPlugin } from '@infinite-canvas-tutorial/yoga';

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
      penbarAll: [Pen.HAND, Pen.SELECT],
    });

    {
      const m = await import('@iconify/json/json/lucide.json');
      registerIconifyIconSet('lucide', m);
    }

    const button1 = {
      id: 'icon-button-1',
      type: 'rect',
      x: 100,
      y: 100,
      fill: 'grey',
      display: 'flex',
      width: 200,
      height: 100,
      padding: 10,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      cornerRadius: 10,
      gap: 10,
      zIndex: 0,
    } as const;

    const SearchIcon = {
      id: 'icon-button-search-icon-lucide',
      parentId: 'icon-button-1',
      type: 'iconfont' as const,
      zIndex: 1,
      iconFontName: 'search',
      iconFontFamily: 'lucide',
      stroke: 'white',
      strokeWidth: 4,
      lockAspectRatio: true,
    };

    const text1 = {
      id: 'icon-button-text-1',
      parentId: 'icon-button-1',
      type: 'text',
      content: 'Button',
      fontFamily: 'system-ui',
      fontSize: 32,
      lineHeight: 40,
      fill: 'white',
      zIndex: 1,
      textAlign: 'center',
      textBaseline: 'middle',
      wordWrap: true,
      wordWrapWidth: 100,
      maxLines: 1,
      textOverflow: 'ellipsis',
    };

    api.runAtNextTick(() => {
      api.updateNodes([button1, SearchIcon, text1]);
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
    new App().addPlugins(...DefaultPlugins, UIPlugin, LaserPointerPlugin, LassoPlugin, EraserPlugin, YogaPlugin).run();
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
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 300px" renderer="webgl"></ic-spectrum-canvas>
</template>