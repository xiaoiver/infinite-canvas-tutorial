import { defineConfig } from 'vitepress';

export const zhHant = defineConfig({
  lang: 'zh-Hant',
  title: '一個無限畫布教程',
  description:
    '一套開源的無限畫布教程，以 HTML5 Canvas、WebGL/WebGPU、ECS、SDF 渲染，以及透過 CRDT/Yjs 進行協同為基礎，幫助開發者打造類似 Figma 的互動式工作區。',
  keywords: [
    '無限畫布',
    '畫布',
    'webgl',
    'webgpu',
    'ecs',
  ],
  themeConfig: {
    nav: [
      { text: '應用', link: 'https://app.infinitecanvas.cc/' },
      {
        text: '指南',
        link: '/zh-Hant/guide/lesson-001',
        activeMatch: '/zh-Hant/guide/',
      },
      // Example, reference, and experiment pages are not translated.
      // These links open the English locale so the sidebar never 404s.
      { text: '範例 (EN)', link: '/example/solar-system' },
      { text: '參考 (EN)', link: '/reference/canvas' },
      { text: '實驗 (EN)', link: '/experiment/particles' },
    ],

    sidebar: {
      '/zh-Hant/guide/': {
        base: '/zh-Hant/guide/',
        items: [
          {
            text: '簡介',
            items: [
              {
                text: '什麼是無限畫布？',
                link: 'what-is-an-infinite-canvas',
              },
            ],
          },
          {
            text: '課程',
            items: [
              {
                text: '第001課 - 初始化畫布',
                link: 'lesson-001',
              },
              {
                text: '第002課 - 繪製圓',
                link: 'lesson-002',
              },
              {
                text: '第003課 - 場景圖與變換',
                link: 'lesson-003',
              },
              {
                text: '第004課 - 相機',
                link: 'lesson-004',
              },
              {
                text: '第005課 - 網格',
                link: 'lesson-005',
              },
              {
                text: '第006課 - 事件系統',
                link: 'lesson-006',
              },
              {
                text: '第007課 - Web UI',
                link: 'lesson-007',
              },
              {
                text: '第008課 - 效能最佳化',
                link: 'lesson-008',
              },
              {
                text: '第009課 - 繪製橢圓與矩形',
                link: 'lesson-009',
              },
              {
                text: '第010課 - 匯入與匯出圖片',
                link: 'lesson-010',
              },
              {
                text: '第011課 - 測試與伺服器端渲染',
                link: 'lesson-011',
              },
              {
                text: '第012課 - 繪製折線',
                link: 'lesson-012',
              },
              {
                text: '第013課 - 繪製路徑與手繪風格',
                link: 'lesson-013',
              },
              {
                text: '第014課 - 畫布模式與輔助 UI',
                link: 'lesson-014',
              },
              {
                text: '第015課 - 文字渲染',
                link: 'lesson-015',
              },
              {
                text: '第016課 - 文字的進階功能',
                link: 'lesson-016',
              },
              {
                text: '第017課 - 漸層與圖案',
                link: 'lesson-017',
              },
              {
                text: '第018課 - 以 ECS 重構',
                link: 'lesson-018',
              },
              {
                text: '第019課 - 歷史紀錄',
                link: 'lesson-019',
              },
              {
                text: '第020課 - 協同編輯',
                link: 'lesson-020',
              },
              {
                text: '第021課 - Transformer',
                link: 'lesson-021',
              },
              {
                text: '第022課 - VectorNetwork',
                link: 'lesson-022',
              },
              {
                text: '第023課 - 心智圖',
                link: 'lesson-023',
              },
              {
                text: '第024課 - 內容選單與剪貼簿',
                link: 'lesson-024',
              },
              {
                text: '第025課 - 繪製模式與筆刷',
                link: 'lesson-025',
              },
              {
                text: '第026課 - 選取工具',
                link: 'lesson-026',
              },
              {
                text: '第027課 - 吸附與對齊',
                link: 'lesson-027',
              },
              {
                text: '第028課 - 與 AI 整合',
                link: 'lesson-028',
              },
              {
                text: '第029課 - 嵌入 HTML 內容',
                link: 'lesson-029',
              },
              {
                text: '第030課 - 後處理與渲染圖',
                link: 'lesson-030',
              },
              {
                text: '第031課 - 圖形之間的綁定',
                link: 'lesson-031',
              },
              {
                text: '第032課 - 文字轉圖表',
                link: 'lesson-032',
              },
              {
                text: '第033課 - 版面引擎',
                link: 'lesson-033',
              },
              {
                text: '第034課 - Group、Frame 與裁切',
                link: 'lesson-034',
              },
              {
                text: '第035課 - 以圖塊為基礎的渲染',
                link: 'lesson-035',
              },
              {
                text: '第036課 - 動畫',
                link: 'lesson-036',
              },
              {
                text: '第037課 - 以 Radiance Cascades 實現全域照明',
                link: 'lesson-037',
              },
              {
                text: '第038課 - 從設計到程式碼',
                link: 'lesson-038',
              },
              {
                text: '第039課 - 3D Mesh 渲染',
                link: 'lesson-039',
              },
            ],
          },
        ],
      },
    },

    editLink: {
      pattern:
        'https://github.com/xiaoiver/infinite-canvas-tutorial/tree/master/packages/site/docs/:path',
      text: '在 GitHub 上編輯此頁',
    },

    docFooter: {
      prev: '上一頁',
      next: '下一頁',
    },

    outline: {
      label: '頁面導覽',
    },

    lastUpdated: {
      text: '最後更新於',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'medium',
      },
    },

    langMenuLabel: '語言',
    returnToTopLabel: '回到頂部',
    sidebarMenuLabel: '選單',
    darkModeSwitchLabel: '主題',
    lightModeSwitchTitle: '切換到淺色模式',
    darkModeSwitchTitle: '切換到深色模式',
  },
});

export const search = {
  placeholder: '搜尋文件',
  translations: {
    button: {
      buttonText: '搜尋文件',
      buttonAriaLabel: '搜尋文件',
    },
    modal: {
      searchBox: {
        resetButtonTitle: '清除查詢',
        resetButtonAriaLabel: '清除查詢',
        cancelButtonText: '取消',
        cancelButtonAriaLabel: '取消',
      },
      startScreen: {
        recentSearchesTitle: '搜尋紀錄',
        noRecentSearchesText: '沒有搜尋紀錄',
        saveRecentSearchButtonTitle: '儲存到搜尋紀錄',
        removeRecentSearchButtonTitle: '從搜尋紀錄中移除',
        favoriteSearchesTitle: '收藏',
        removeFavoriteSearchButtonTitle: '從收藏中移除',
      },
      errorScreen: {
        titleText: '無法取得結果',
        helpText: '請檢查網路連線',
      },
      footer: {
        selectText: '選取',
        navigateText: '切換',
        closeText: '關閉',
        searchByText: '搜尋提供者',
      },
      noResultsScreen: {
        noResultsText: '找不到相關結果',
        suggestedQueryText: '你可以嘗試查詢',
        reportMissingResultsText: '你認為這個查詢應該有結果嗎？',
        reportMissingResultsLinkText: '點此回饋',
      },
    },
  },
};
