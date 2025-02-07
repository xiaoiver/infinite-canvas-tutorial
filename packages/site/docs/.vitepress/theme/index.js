// .vitepress/theme/index.js
import DefaultTheme from 'vitepress/theme';
import './custom.css';
import Layout from 'genji-theme-vitepress';
import { h } from 'vue';
import Stats from 'stats.js';
import { ImageLoader } from '@loaders.gl/images';
import { load } from '@loaders.gl/core';
import GUI from 'lil-gui';
import * as Core from '@infinite-canvas-tutorial/core';
import * as UI from '@infinite-canvas-tutorial/ui';
import * as Lesson1 from '@infinite-canvas-tutorial/lesson1';
import * as Lesson2 from '@infinite-canvas-tutorial/lesson2';
import * as Lesson3 from '@infinite-canvas-tutorial/lesson3';
import * as Lesson4 from '@infinite-canvas-tutorial/lesson4';
import * as Lesson5 from '@infinite-canvas-tutorial/lesson5';
import * as Lesson6 from '@infinite-canvas-tutorial/lesson6';
import * as Lesson7 from '@infinite-canvas-tutorial/lesson7';
import * as Lesson8 from '@infinite-canvas-tutorial/lesson8';
import * as Lesson9 from '@infinite-canvas-tutorial/lesson9';
import * as Lesson10 from '@infinite-canvas-tutorial/lesson10';
import * as Lesson12 from '@infinite-canvas-tutorial/lesson12';
import * as Lesson13 from '@infinite-canvas-tutorial/lesson13';

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

  loadImage: async (src) => load(src, ImageLoader),
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
    Lesson9,
    Lesson10,
    Lesson12,
    Lesson13,
    Utils,
    Stats,
    Core,
    UI,
    GUI,
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
        'https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.19.1/cdn',
      );
      await import('@shoelace-style/shoelace');
    }
  },
};
