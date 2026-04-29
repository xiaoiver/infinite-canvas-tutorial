<script setup lang="ts">
import {
  App,
  Pen,
  DefaultPlugins,
  registerIconifyIconSet,
  Task,
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
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT],
      penbarNameLabelVisible: true,
      taskbarSelected: [Task.SHOW_LAYERS_PANEL],
    });

    {
      const m = await import('@iconify/json/json/lucide.json');
      registerIconifyIconSet('lucide', m);
    }

    const button1 = {
      id: 'icon-button',
      type: 'rect',
      name: 'Button/Default',
      x: 100,
      y: 100,
      fill: 'grey',
      display: 'flex',
      padding: [16, 16],
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      cornerRadius: 30,
      gap: 4,
      zIndex: 0,
      reusable: true,
    } as const;

    const SearchIcon = {
      id: 'icon-button-icon',
      parentId: 'icon-button',
      type: 'iconfont' as const,
      zIndex: 1,
      iconFontName: 'search',
      iconFontFamily: 'lucide',
      stroke: 'white',
      strokeWidth: 2,
      width: 32,
      height: 32,
      lockAspectRatio: true,
    };

    const text1 = {
      id: 'icon-button-text',
      parentId: 'icon-button',
      type: 'text',
      content: 'Button',
      fontFamily: 'system-ui',
      fontSize: 24,
      lineHeight: 32,
      fill: 'white',
      zIndex: 1,
      textAlign: 'center',
      textBaseline: 'middle',
      // wordWrap: true,
      // wordWrapWidth: 100,
      // maxLines: 1,
      // textOverflow: 'ellipsis',
    };

    const button2 = {
      id: 'icon-button-variant-destructive',
      type: 'ref',
      ref: 'icon-button',
      name: 'Button/Destructive',
      x: 100,
      y: 200,
      fill: 'red',
      zIndex: 0,
      descendants: {
        'icon-button-icon': {
          iconFontName: 'circle-alert',
        },
        'icon-button-text': {
          content: 'Destructive',
        },
      },
    };

    const button3 = {
      id: 'icon-button-variant-liquid-metal',
      type: 'ref',
      ref: 'icon-button',
      name: 'Button/LiquidMetal',
      x: 100,
      y: 300,
      fill: 'black',
      zIndex: 0,
      descendants: {
        'icon-button-icon': {
          iconFontName: 'sparkles',
        },
        'icon-button-text': {
          fill: 'white',
          content: 'Liquid Metal',
        },
      },
      filter: 'liquid-metal(2, 0.1, 0.3, 0.3, 0.07, 0.4, 70, 3, 1, transparent, #ffffff, auto, 1)',
    };

    const button4 = {
      id: 'icon-button-variant-liquid-heatmap',
      type: 'ref',
      ref: 'icon-button',
      name: 'Button/Heatmap',
      x: 100,
      y: 400,
      fill: 'black',
      zIndex: 0,
      descendants: {
        'icon-button-icon': {
          iconFontName: 'sparkles',
        },
        'icon-button-text': {
          fill: 'white',
          content: 'Heatmap',
          wordWrap: false,
        },
      },
      filter: 'heat-map(0.5, 0, 0, 0.5, 0.5, 1, 1, auto, #000000, #112069, #1f3ca3, #3265e7, #6bd8ff, #ffe77a, #ff9a1f, #ff4d00)',
    };


    api.runAtNextTick(() => {
      api.updateNodes([
        button1, SearchIcon, text1,
        button2,
        button3,
        button4
      ]);
      api.record();
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
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 400px"
    app-state='{"topbarVisible":true, "cameraZoom": 0.8, "cameraY": 50}'>
  </ic-spectrum-canvas>
</template>