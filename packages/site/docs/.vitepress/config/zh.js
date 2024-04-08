import { defineConfig } from 'vitepress';

export const zh = defineConfig({
  lang: 'zh-Hans',
  title: '一个无限画布教程',
  description: '一个无限画布教程',
  themeConfig: {
    nav: [
      { text: '主页', link: '/zh' },
      { text: '课程', link: '/zh/lesson-001' },
    ],

    sidebar: [
      {
        text: '课程',
        items: [
          { text: '课程1 - 初始化画布', link: '/zh/lesson-001' },
          { text: '课程2 - 绘制圆', link: '/zh/lesson-002' },
        ],
      },
    ],

    docFooter: {
      prev: '上一页',
      next: '下一页',
    },

    outline: {
      label: '页面导航',
    },

    lastUpdated: {
      text: '最后更新于',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'medium',
      },
    },

    langMenuLabel: '多语言',
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
  },
});
