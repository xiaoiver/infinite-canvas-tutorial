import { defineConfig } from 'vitepress';

export const zh = defineConfig({
  lang: 'zh-Hans',
  title: '一个无限画布教程',
  description: '一个无限画布教程',
  themeConfig: {
    nav: [
      { text: '课程', link: '/zh/guide/lesson-001', activeMatch: '/zh/guide/' },
      {
        text: '案例',
        link: '/zh/example/solar-system',
        activeMatch: '/zh/example/',
      },
      {
        text: '文档',
        link: '/zh/reference/canvas',
        activeMatch: '/zh/reference/',
      },
    ],

    sidebar: {
      '/zh/guide/': {
        base: '/zh/guide/',
        items: [
          {
            text: '介绍',
            items: [
              {
                text: '什么是无限画布？',
                link: '/zh/guide/what-is-an-infinite-canvas',
              },
            ],
          },
          {
            text: '课程',
            items: [
              { text: '课程1 - 初始化画布', link: 'lesson-001' },
              { text: '课程2 - 绘制圆', link: 'lesson-002' },
              { text: '课程3 - 场景图和变换', link: 'lesson-003' },
              { text: '课程4 - 相机', link: 'lesson-004' },
              { text: '课程5 - 绘制网格', link: 'lesson-005' },
              { text: '课程6 - 事件系统', link: 'lesson-006' },
              { text: '课程7 - UI 组件', link: 'lesson-007' },
              { text: '课程8 - 性能优化', link: 'lesson-008' },
            ],
          },
        ],
      },
      '/zh/reference/': {
        base: '/zh/reference/',
        items: [
          {
            text: '画布',
            link: 'canvas',
          },
          {
            text: '相机',
            link: 'camera',
          },
          {
            text: '图形',
            items: [
              { text: 'Shape', link: 'shape' },
              { text: 'Group', link: 'group' },
              { text: 'Circle', link: 'circle' },
            ],
          },
        ],
      },
      '/zh/example/': {
        base: '/zh/example/',
        items: [
          {
            text: '案例',
            items: [
              { text: '一个太阳系模型', link: 'solar-system' },
              { text: '通过剔除减少 draw call', link: 'culling' },
              {
                text: '通过实例化数组减少 draw call',
                link: 'instanced',
              },
              {
                text: '通过 RBush 加速拾取',
                link: 'picking',
              },
            ],
          },
        ],
      },
    },

    editLink: {
      pattern:
        'https://github.com/xiaoiver/infinite-canvas-tutorial/tree/master/packages/site/docs/:path',
      text: '在 GitHub 上编辑此页面',
    },

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

export const search = {
  placeholder: '搜索文档',
  translations: {
    button: {
      buttonText: '搜索文档',
      buttonAriaLabel: '搜索文档',
    },
    modal: {
      searchBox: {
        resetButtonTitle: '清除查询条件',
        resetButtonAriaLabel: '清除查询条件',
        cancelButtonText: '取消',
        cancelButtonAriaLabel: '取消',
      },
      startScreen: {
        recentSearchesTitle: '搜索历史',
        noRecentSearchesText: '没有搜索历史',
        saveRecentSearchButtonTitle: '保存至搜索历史',
        removeRecentSearchButtonTitle: '从搜索历史中移除',
        favoriteSearchesTitle: '收藏',
        removeFavoriteSearchButtonTitle: '从收藏中移除',
      },
      errorScreen: {
        titleText: '无法获取结果',
        helpText: '你可能需要检查你的网络连接',
      },
      footer: {
        selectText: '选择',
        navigateText: '切换',
        closeText: '关闭',
        searchByText: '搜索提供者',
      },
      noResultsScreen: {
        noResultsText: '无法找到相关结果',
        suggestedQueryText: '你可以尝试查询',
        reportMissingResultsText: '你认为该查询应该有结果？',
        reportMissingResultsLinkText: '点击反馈',
      },
    },
  },
};
