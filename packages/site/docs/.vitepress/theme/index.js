// .vitepress/theme/index.js
import DefaultTheme from 'vitepress/theme';
import Layout from 'genji-theme-vitepress';
import { h } from 'vue';
import Stats from 'stats.js';
import * as Lesson1 from '@infinite-canvas-tutorial/lesson1';
import * as Lesson2 from '@infinite-canvas-tutorial/lesson2';
import * as Lesson3 from '@infinite-canvas-tutorial/lesson3';
import * as Lesson4 from '@infinite-canvas-tutorial/lesson4';
import * as Lesson5 from '@infinite-canvas-tutorial/lesson5';

const Utils = {
  createCanvas: async (Canvas, width, height) => {
    const $canvas = document.createElement('canvas');
    $canvas.style.outline = 'none';
    $canvas.style.padding = '0px';
    $canvas.style.margin = '0px';
    $canvas.style.border = '1px solid black';

    const canvas = await new Canvas({
      canvas: $canvas,
      renderer: 'webgl',
      shaderCompilerPath:
        'https://unpkg.com/@antv/g-device-api@1.6.8/dist/pkg/glsl_wgsl_compiler_bg.wasm',
    }).initialized;

    const resize = (width, height) => {
      $canvas.width = width * window.devicePixelRatio;
      $canvas.height = height * window.devicePixelRatio;
      $canvas.style.width = `${width}px`;
      $canvas.style.height = `${height}px`;
      canvas.resize(width, height);
    };
    resize(width, height);

    return [$canvas, canvas];
  },
};

const props = {
  Theme: DefaultTheme,
  library: {
    Lesson1,
    Lesson2,
    Lesson3,
    Lesson4,
    Lesson5,
    Utils,
    Stats,
  },
};

export default {
  extends: DefaultTheme,
  Layout: () => h(Layout, props),
};
