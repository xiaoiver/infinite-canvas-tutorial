// .vitepress/theme/index.js
import DefaultTheme from 'vitepress/theme';
import '@shoelace-style/shoelace/dist/themes/light.css';
import './custom.css';
import Layout from 'genji-theme-vitepress';
import { h } from 'vue';
import Stats from 'stats.js';
import * as Lesson1 from '@infinite-canvas-tutorial/lesson1';
import * as Lesson2 from '@infinite-canvas-tutorial/lesson2';
import * as Lesson3 from '@infinite-canvas-tutorial/lesson3';
import * as Lesson4 from '@infinite-canvas-tutorial/lesson4';
import * as Lesson5 from '@infinite-canvas-tutorial/lesson5';
import * as Lesson6 from '@infinite-canvas-tutorial/lesson6';
import * as Lesson7 from '@infinite-canvas-tutorial/lesson7';
import * as Lesson8 from '@infinite-canvas-tutorial/lesson8';

const Utils = {
  createCanvas: async (Canvas, width, height, renderer = 'webgl') => {
    const $canvas = document.createElement('canvas');
    $canvas.style.outline = 'none';
    $canvas.style.padding = '0px';
    $canvas.style.margin = '0px';
    $canvas.style.border = '1px solid black';
    $canvas.width = width * window.devicePixelRatio;
    $canvas.height = height * window.devicePixelRatio;
    $canvas.style.width = `${width}px`;
    $canvas.style.height = `${height}px`;
    $canvas.style.touchAction = 'none';

    const canvas = await new Canvas({
      canvas: $canvas,
      renderer,
      shaderCompilerPath:
        'https://unpkg.com/@antv/g-device-api@1.6.8/dist/pkg/glsl_wgsl_compiler_bg.wasm',
    }).initialized;

    return canvas;
  },

  resizeCanvas: (canvas, width, height) => {
    const $canvas = canvas.getDOM();
    $canvas.width = width * window.devicePixelRatio;
    $canvas.height = height * window.devicePixelRatio;
    $canvas.style.width = `${width}px`;
    $canvas.style.height = `${height}px`;
    $canvas.style.touchAction = 'none';
    canvas.resize(width, height);
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
    Lesson6,
    Lesson7,
    Lesson8,
    Utils,
    Stats,
  },
};

export default {
  extends: DefaultTheme,
  Layout: () => h(Layout, props),
  async enhanceApp({ app }) {
    // @see https://vitepress.dev/guide/ssr-compat#conditional-import
    if (!import.meta.env.SSR) {
      // @see https://shoelace.style/tutorials/integrating-with-nextjs/#defining-custom-elements
      const { setBasePath } = await import(
        '@shoelace-style/shoelace/dist/utilities/base-path'
      );
      setBasePath(
        'https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.15.0/cdn/',
      );
      await import('@shoelace-style/shoelace');
    }
  },
};
