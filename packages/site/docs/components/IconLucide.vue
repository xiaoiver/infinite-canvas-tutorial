<script setup lang="ts">
import {
  Pen,
  Task,
  registerIconifyIconSet,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { ensureExampleWorld } from '../lib/ensure-example-world';
import { Event } from '@infinite-canvas-tutorial/webcomponents';

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
      fills: [{ type: 'solid', value: 'red', opacity: 1 }],
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
      fills: [{ type: 'solid', value: 'red', opacity: 1 }],
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
      fills: [{ type: 'solid', value: 'red', opacity: 1 }],
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
      fills: [{ type: 'solid', value: 'red', opacity: 1 }],
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

    const ClaudeIcon = {
      id: 'claude-icon-material-icon-theme',
      type: 'iconfont' as const,
      x: 200,
      y: 300,
      width: 32,
      height: 32,
      zIndex: 1,
      iconFontName: 'claude',
      iconFontFamily: 'material-icon-theme',
      lockAspectRatio: true,
    };

    const CudaIcon = {
      id: 'cuda-icon-material-icon-theme',
      type: 'iconfont' as const,
      x: 250,
      y: 300,
      width: 32,
      height: 32,
      zIndex: 1,
      iconFontName: 'cuda',
      iconFontFamily: 'material-icon-theme',
      lockAspectRatio: true,
    };

    api.runAtNextTick(() => {
      api.updateNodes([SearchIcon, AtomIcon, AudioLinesIcon, CarrotIcon, AArrowDownIcon, AlgorithmIcon, AnnoyedIcon, GiftIcon, AndroidIcon, BlenderIcon, ClaudeIcon, CudaIcon]);
      api.selectNodes([SearchIcon]);
    });
  };

  canvas.addEventListener(Event.READY, onReady);

  await ensureExampleWorld();
});

onUnmounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  if (onReady) {
    canvas.removeEventListener(Event.READY, onReady);
  }

});
</script>

<template>
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 500px" renderer="webgl"></ic-spectrum-canvas>
</template>