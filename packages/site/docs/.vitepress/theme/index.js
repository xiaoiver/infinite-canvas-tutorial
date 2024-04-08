// .vitepress/theme/index.js
import DefaultTheme from 'vitepress/theme';
import Layout from 'genji-theme-vitepress';
import { h } from 'vue';
import * as Lesson1 from '@infinite-canvas-tutorial/lesson1';
import * as Lesson2 from '@infinite-canvas-tutorial/lesson2';

const props = {
  Theme: DefaultTheme,
  library: {
    Lesson1,
    Lesson2,
  },
};

export default {
  extends: DefaultTheme,
  Layout: () => h(Layout, props),
};
