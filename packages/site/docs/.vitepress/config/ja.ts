import { defineConfig } from 'vitepress';

export const ja = defineConfig({
  lang: 'ja-JP',
  title: '無限キャンバスチュートリアル',
  description:
    'HTML5 Canvas、WebGL/WebGPU、ECS、SDF レンダリング、CRDT/Yjs による共同編集を通じて、Figma のようなインタラクティブなワークスペースを作るためのオープンソースな無限キャンバスチュートリアルです。',
  keywords: ['無限キャンバス', 'キャンバス', 'webgl', 'webgpu', 'ecs'],
  themeConfig: {
    nav: [
      { text: 'アプリ', link: 'https://app.infinitecanvas.cc/' },
      {
        text: 'ガイド',
        link: '/ja/guide/lesson-001',
        activeMatch: '/ja/guide/',
      },
      // Example, reference, and experiment pages are not translated.
      // These links open the English locale so the sidebar never 404s.
      { text: 'サンプル (EN)', link: '/example/solar-system' },
      { text: 'リファレンス (EN)', link: '/reference/canvas' },
      { text: '実験 (EN)', link: '/experiment/particles' },
    ],

    sidebar: {
      '/ja/guide/': {
        base: '/ja/guide/',
        items: [
          {
            text: 'はじめに',
            items: [
              {
                text: '無限キャンバスとは？',
                link: 'what-is-an-infinite-canvas',
              },
            ],
          },
          {
            text: 'レッスン',
            items: [
              {
                text: '第001課 - キャンバスの初期化',
                link: 'lesson-001',
              },
              {
                text: '第002課 - 円を描く',
                link: 'lesson-002',
              },
              {
                text: '第003課 - シーングラフと変換',
                link: 'lesson-003',
              },
              {
                text: '第004課 - カメラ',
                link: 'lesson-004',
              },
              {
                text: '第005課 - グリッド',
                link: 'lesson-005',
              },
              {
                text: '第006課 - イベントシステム',
                link: 'lesson-006',
              },
              {
                text: '第007課 - Web UI',
                link: 'lesson-007',
              },
              {
                text: '第008課 - パフォーマンス最適化',
                link: 'lesson-008',
              },
              {
                text: '第009課 - 楕円と矩形を描く',
                link: 'lesson-009',
              },
              {
                text: '第010課 - 画像の読み込みと書き出し',
                link: 'lesson-010',
              },
              {
                text: '第011課 - テストとサーバーサイドレンダリング',
                link: 'lesson-011',
              },
              {
                text: '第012課 - ポリラインを描く',
                link: 'lesson-012',
              },
              {
                text: '第013課 - パスとスケッチスタイル',
                link: 'lesson-013',
              },
              {
                text: '第014課 - キャンバスモードと補助 UI',
                link: 'lesson-014',
              },
              {
                text: '第015課 - テキストレンダリング',
                link: 'lesson-015',
              },
              {
                text: '第016課 - テキストの高度な機能',
                link: 'lesson-016',
              },
              {
                text: '第017課 - グラデーションとパターン',
                link: 'lesson-017',
              },
              {
                text: '第018課 - ECS でリファクタリング',
                link: 'lesson-018',
              },
              {
                text: '第019課 - 履歴',
                link: 'lesson-019',
              },
              {
                text: '第020課 - 共同編集',
                link: 'lesson-020',
              },
              {
                text: '第021課 - トランスフォーマー',
                link: 'lesson-021',
              },
              {
                text: '第022課 - VectorNetwork',
                link: 'lesson-022',
              },
              {
                text: '第023課 - マインドマップ',
                link: 'lesson-023',
              },
              {
                text: '第024課 - コンテキストメニューとクリップボード',
                link: 'lesson-024',
              },
              {
                text: '第025課 - 描画モードとブラシ',
                link: 'lesson-025',
              },
              {
                text: '第026課 - 選択ツール',
                link: 'lesson-026',
              },
              {
                text: '第027課 - スナップと整列',
                link: 'lesson-027',
              },
              {
                text: '第028課 - AI との連携',
                link: 'lesson-028',
              },
              {
                text: '第029課 - HTML コンテンツの埋め込み',
                link: 'lesson-029',
              },
              {
                text: '第030課 - ポストプロセスとレンダーグラフ',
                link: 'lesson-030',
              },
              {
                text: '第031課 - 図形間のバインディング',
                link: 'lesson-031',
              },
              {
                text: '第032課 - テキストからダイアグラム',
                link: 'lesson-032',
              },
              {
                text: '第033課 - レイアウトエンジン',
                link: 'lesson-033',
              },
              {
                text: '第034課 - Group、Frame とクリップ',
                link: 'lesson-034',
              },
              {
                text: '第035課 - タイルベースレンダリング',
                link: 'lesson-035',
              },
              {
                text: '第036課 - アニメーション',
                link: 'lesson-036',
              },
              {
                text: '第037課 - Radiance Cascades による GI',
                link: 'lesson-037',
              },
              {
                text: '第038課 - デザインからコードへ',
                link: 'lesson-038',
              },
              {
                text: '第039課 - 3D メッシュレンダリング',
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
      text: 'GitHub でこのページを編集',
    },

    docFooter: {
      prev: '前のページ',
      next: '次のページ',
    },

    outline: {
      label: 'ページ内ナビゲーション',
    },

    lastUpdated: {
      text: '最終更新',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'medium',
      },
    },

    langMenuLabel: '言語',
    returnToTopLabel: 'トップへ戻る',
    sidebarMenuLabel: 'メニュー',
    darkModeSwitchLabel: 'テーマ',
    lightModeSwitchTitle: 'ライトモードに切り替え',
    darkModeSwitchTitle: 'ダークモードに切り替え',
  },
});

export const search = {
  placeholder: 'ドキュメントを検索',
  translations: {
    button: {
      buttonText: 'ドキュメントを検索',
      buttonAriaLabel: 'ドキュメントを検索',
    },
    modal: {
      searchBox: {
        resetButtonTitle: '検索条件をクリア',
        resetButtonAriaLabel: '検索条件をクリア',
        cancelButtonText: 'キャンセル',
        cancelButtonAriaLabel: 'キャンセル',
      },
      startScreen: {
        recentSearchesTitle: '最近の検索',
        noRecentSearchesText: '最近の検索はありません',
        saveRecentSearchButtonTitle: '最近の検索に保存',
        removeRecentSearchButtonTitle: '最近の検索から削除',
        favoriteSearchesTitle: 'お気に入り',
        removeFavoriteSearchButtonTitle: 'お気に入りから削除',
      },
      errorScreen: {
        titleText: '結果を取得できません',
        helpText: 'ネットワーク接続を確認してください',
      },
      footer: {
        selectText: '選択',
        navigateText: '移動',
        closeText: '閉じる',
        searchByText: '検索プロバイダ',
      },
      noResultsScreen: {
        noResultsText: '関連する結果がありません',
        suggestedQueryText: '次のクエリを試せます',
        reportMissingResultsText: 'このクエリには結果があるべきですか？',
        reportMissingResultsLinkText: 'フィードバック',
      },
    },
  },
};
