import { defineConfig } from 'vitepress';

export const zh = defineConfig({
  lang: 'zh-Hans',
  title: '一个无限画布教程',
  description: '一个无限画布教程',
  themeConfig: {
    nav: [
      { text: '课程', link: '/zh/lesson-001' },
      { text: '案例', link: '/zh/demo' },
    ],
    sidebar: [
      {
        text: '介绍',
        items: [
          {
            text: '什么是无限画布？',
            link: '/zh/what-is-an-infinite-canvas',
          },
        ],
      },
      {
        text: '课程',
        items: [
          { text: '课程1 - 初始化画布', link: '/zh/lesson-001' },
          { text: '课程2 - 绘制圆', link: '/zh/lesson-002' },
          { text: '课程3 - 场景图和变换', link: '/zh/lesson-003' },
          { text: '课程4 - 相机', link: '/zh/lesson-004' },
          { text: '课程5 - 绘制网格', link: '/zh/lesson-005' },
          { text: '课程6 - 事件系统', link: '/zh/lesson-006' },
          { text: '课程7 - UI 组件', link: '/zh/lesson-007' },
        ],
      },
      {
        text: '案例',
        items: [{ text: '一个太阳系', link: '/zh/demo' }],
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
