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
      taskbarSelected: [
        Task.SHOW_PROPERTIES_PANEL,
      ],
      propertiesPanelSectionsOpen: {
        shape: true,
        transform: false,
        layout: false,
        effects: false,
        multiSelectAlignment: true,
        multiSelectEffects: true,
        exportSection: true,
      },
    });

    {
      const m = await import('@iconify/json/json/lucide.json');
      registerIconifyIconSet('lucide', m);
    }
    {
      const m = await import('@iconify/json/json/pixelarticons.json');
      registerIconifyIconSet('pixelarticons', m);
    }
    {
      const m = await import('@iconify/json/json/material-icon-theme.json');
      registerIconifyIconSet('material-icon-theme', m);
    }

    const SearchIcon = {
      id: 'search-icon-lucide',
      type: 'iconfont' as const,
      x: 100,
      y: 100,
      width: 32,
      height: 32,
      zIndex: 1,
      iconFontName: 'search',
      iconFontFamily: 'lucide',
      stroke: 'red',
      strokeWidth: 2,
      lockAspectRatio: true,
    };

    const AtomIcon = {
      id: 'atom-icon-lucide',
      type: 'iconfont' as const,
      x: 150,
      y: 100,
      width: 32,
      height: 32,
      zIndex: 1,
      iconFontName: 'atom',
      iconFontFamily: 'lucide',
      stroke: 'red',
      strokeWidth: 2,
      lockAspectRatio: true,
    };

    const AudioLinesIcon = {
      id: 'audio-lines-icon-lucide',
      type: 'iconfont' as const,
      x: 200,
      y: 100,
      width: 32,
      height: 32,
      zIndex: 1,
      iconFontName: 'audio-lines',
      iconFontFamily: 'lucide',
      stroke: 'red',
      strokeWidth: 2,
      lockAspectRatio: true,
    };

    const CarrotIcon = {
      id: 'carrot-icon-lucide',
      type: 'iconfont' as const,
      x: 250,
      y: 100,
      width: 32,
      height: 32,
      zIndex: 1,
      iconFontName: 'carrot',
      iconFontFamily: 'lucide',
      stroke: 'red',
      strokeWidth: 2,
      lockAspectRatio: true,
    };

    const AArrowDownIcon = {
      id: 'arrow-down-icon-pixelarticons',
      type: 'iconfont' as const,
      x: 100,
      y: 200,
      width: 32,
      height: 32,
      zIndex: 1,
      iconFontName: 'a-arrow-down',
      iconFontFamily: 'pixelarticons',
      // stroke: 'red',
      fill: 'red',
      // strokeWidth: 2,
      lockAspectRatio: true,
    };

    const AlgorithmIcon = {
      id: 'algorithm-icon-pixelarticons',
      type: 'iconfont' as const,
      x: 150,
      y: 200,
      width: 32,
      height: 32,
      zIndex: 1,
      iconFontName: 'algorithm',
      iconFontFamily: 'pixelarticons',
      fill: 'red',
      lockAspectRatio: true,
    };

    const AnnoyedIcon = {
      id: 'annoyed-icon-pixelarticons',
      type: 'iconfont' as const,
      x: 200,
      y: 200,
      width: 32,
      height: 32,
      zIndex: 1,
      iconFontName: 'annoyed',
      iconFontFamily: 'pixelarticons',
      fill: 'red',
      lockAspectRatio: true,
    };

    const GiftIcon = {
      id: 'gift-icon-pixelarticons',
      type: 'iconfont' as const,
      x: 250,
      y: 200,
      width: 32,
      height: 32,
      zIndex: 1,
      iconFontName: 'gift',
      iconFontFamily: 'pixelarticons',
      fill: 'red',
      lockAspectRatio: true,
    };

    const AndroidIcon = {
      id: 'android-icon-material-icon-theme',
      type: 'iconfont' as const,
      x: 100,
      y: 300,
      width: 32,
      height: 32,
      zIndex: 1,
      iconFontName: 'android',
      iconFontFamily: 'material-icon-theme',
      lockAspectRatio: true,
    };

    const BlenderIcon = {
      id: 'blender-icon-material-icon-theme',
      type: 'iconfont' as const,
      x: 150,
      y: 300,
      width: 32,
      height: 32,
      zIndex: 1,
      iconFontName: 'blender',
      iconFontFamily: 'material-icon-theme',
      lockAspectRatio: true,
    };

    api.runAtNextTick(() => {
      api.updateNodes([SearchIcon, AtomIcon, AudioLinesIcon, CarrotIcon, AArrowDownIcon, AlgorithmIcon, AnnoyedIcon, GiftIcon, AndroidIcon, BlenderIcon]);
      api.selectNodes([SearchIcon]);
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
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 500px" renderer="webgl"></ic-spectrum-canvas>
</template>