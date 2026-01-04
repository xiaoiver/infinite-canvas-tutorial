import { defineConfig } from 'vitepress';

export const zh = defineConfig({
  lang: 'zh-Hans',
  title: '一个无限画布教程',
  description:
    '一个开源的无限画布教程，基于 HTML5 Canvas、WebGL/WebGPU、ECS 架构、SDF 渲染及 CRDT/Yjs 协同，帮助开发者打造类似 Figma 的交互式画布。',
  keywords: [
    '无限画布',
    'infinite canvas',
    'canvas',
    'webgl',
    'webgpu',
    'ecs',
    'crdt',
  ],
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
      {
        text: '实验',
        link: '/zh/experiment/particles',
        activeMatch: '/zh/experiment/',
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
                link: 'what-is-an-infinite-canvas',
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
              { text: '课程9 - 绘制椭圆和矩形', link: 'lesson-009' },
              { text: '课程10 - 图片导入导出', link: 'lesson-010' },
              { text: '课程11 - 测试与服务端渲染', link: 'lesson-011' },
              { text: '课程12 - 绘制折线', link: 'lesson-012' },
              { text: '课程13 - 绘制 Path 和手绘风格', link: 'lesson-013' },
              { text: '课程14 - 画布模式与辅助 UI', link: 'lesson-014' },
              { text: '课程15 - 绘制文本', link: 'lesson-015' },
              { text: '课程16 - 文本的高级特性', link: 'lesson-016' },
              { text: '课程17 - 渐变和重复图案', link: 'lesson-017' },
              { text: '课程18 - 使用 ECS 重构', link: 'lesson-018' },
              { text: '课程19 - 历史记录', link: 'lesson-019' },
              { text: '课程20 - 协同', link: 'lesson-020' },
              { text: '课程21 - Transformer', link: 'lesson-021' },
              { text: '课程22 - VectorNetwork', link: 'lesson-022' },
              { text: '课程23 - 思维导图', link: 'lesson-023' },
              { text: '课程24 - 上下文菜单和剪贴板', link: 'lesson-024' },
              { text: '课程25 - 绘制模式与笔刷', link: 'lesson-025' },
              { text: '课程26 - 选择工具', link: 'lesson-026' },
              { text: '课程27 - 吸附与对齐', link: 'lesson-027' },
              { text: '课程28 - 与 AI 结合', link: 'lesson-028' },
              { text: '课程29 - 嵌入 HTML 内容', link: 'lesson-029' },
              { text: '课程30 - 后处理与渲染图', link: 'lesson-030' },
            ],
          },
        ],
      },
      '/zh/reference/': {
        base: '/zh/reference/',
        items: [
          {
            text: '环境适配器',
            link: 'environment',
          },
          {
            text: '创建应用',
            link: 'create-app',
          },
          {
            text: 'API',
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
                text: '画笔工具',
                link: 'pen',
              },
              {
                text: '导出图片',
                link: 'export-image',
              },
              {
                text: 'AI',
                link: 'ai',
              },
            ],
          },
          {
            text: '插件',
            items: [
              { text: 'Chat', link: 'chat' },
              {
                text: 'fal.ai',
                link: 'fal',
              },
              { text: 'Segment Anything Model', link: 'sam' },
              { text: 'LaMa', link: 'lama' },
              { text: 'UpscalerJS', link: 'upscaler' },
              { text: '激光笔', link: 'laser-pointer' },
              { text: '套索工具', link: 'lasso' },
              { text: '橡皮擦工具', link: 'eraser' },
            ],
          },
          {
            text: '图形',
            items: [
              { text: 'Shape', link: 'shape' },
              { text: 'Group', link: 'group' },
              { text: 'Circle', link: 'circle' },
              { text: 'Ellipse', link: 'ellipse' },
              { text: 'Rect', link: 'rect' },
              { text: 'Polyline', link: 'polyline' },
              { text: 'Path', link: 'path' },
              { text: 'Text', link: 'text' },
              { text: 'RoughCircle', link: 'rough-circle' },
              { text: 'RoughEllipse', link: 'rough-ellipse' },
              { text: 'RoughRect', link: 'rough-rect' },
              { text: 'RoughPolyline', link: 'rough-polyline' },
              { text: 'RoughPath', link: 'rough-path' },
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
              { text: '使用 WebGPU', link: 'webgpu' },
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
              {
                text: '绘制一个矩形',
                link: 'rect',
              },
              {
                text: '为圆角矩形添加阴影',
                link: 'rounded-rectangle-shadow',
              },
              {
                text: '在 WebWorker 中渲染画布',
                link: 'webworker',
              },
              {
                text: '将画布内容导出成图片',
                link: 'exporter',
              },
              {
                text: '导入 SVG',
                link: 'import-svg',
              },
              {
                text: 'wikipedia 数据集可视化',
                link: 'wikipedia-datamap',
              },
              {
                text: '手绘图形',
                link: 'rough',
              },
              {
                text: '绘制网格',
                link: 'wireframe',
              },
              {
                text: '绘制 Path 中的孔洞',
                link: 'holes',
              },
              {
                text: '填充规则',
                link: 'fill-rule',
              },
              {
                text: '文本',
                items: [
                  {
                    text: '使用 SDF 绘制文本',
                    link: 'sdf-text',
                  },
                  {
                    text: '使用 Bitmap Font 绘制文本',
                    link: 'bitmap-font',
                  },
                  {
                    text: '使用 MSDF 绘制文本',
                    link: 'msdf-text',
                  },
                  {
                    text: '绘制表情符号',
                    link: 'emoji',
                  },
                  {
                    text: '绘制双向文字',
                    link: 'bidi',
                  },
                  {
                    text: '使用 HarfBuzz 进行 Shaping',
                    link: 'harfbuzz',
                  },
                  {
                    text: '使用 Opentype.js 进行 Shaping',
                    link: 'opentype',
                  },
                  {
                    text: '文本基线',
                    link: 'text-baseline',
                  },
                  {
                    text: '文本阴影',
                    link: 'text-dropshadow',
                  },
                  {
                    text: '文本描边',
                    link: 'text-stroke',
                  },
                  {
                    text: '文本装饰',
                    link: 'text-decoration',
                  },
                  {
                    text: '文本路径',
                    link: 'text-path',
                  },
                  {
                    text: '晕染效果的文本',
                    link: 'physical-text',
                  },
                  {
                    text: '加载 Web 字体',
                    link: 'web-font-loader',
                  },
                  {
                    text: '渲染 TeX 公式',
                    link: 'tex-math',
                  },
                  {
                    text: '文本编辑器',
                    link: 'text-editor',
                  },
                ],
              },
              {
                text: 'Web Animations API',
                link: 'web-animations-api',
              },
              {
                text: '选择画布模式',
                link: 'canvas-mode-select',
              },
              {
                text: '通过上移下移调整层级',
                link: 'zindex',
              },
              {
                text: '拖拽导入图片',
                link: 'dragndrop-image',
              },
              {
                text: '声明式渐变',
                link: 'declarative-gradient',
              },
              {
                text: '重复图案',
                link: 'pattern',
              },
              {
                text: '图像处理',
                link: 'image-processing',
              },
              {
                text: '思维导图和布局',
                items: [
                  {
                    text: '思维导图',
                    link: 'mindmap',
                  },
                  {
                    text: '树形图',
                    link: 'tree',
                  },
                  {
                    text: 'FlexTree',
                    link: 'flextree',
                  },
                ],
              },
              {
                text: '绘制图形工具',
                items: [
                  {
                    text: '矩形工具',
                    link: 'draw-rect',
                  },
                  {
                    text: '箭头工具',
                    link: 'draw-arrow',
                  },
                  {
                    text: '铅笔工具',
                    link: 'pencil',
                  },
                  {
                    text: '铅笔工具（自由绘制）',
                    link: 'pencil-freehand',
                  },
                  {
                    text: '激光笔工具',
                    link: 'laser-pointer',
                  },
                  {
                    text: '套索工具',
                    link: 'lasso',
                  },
                ],
              },
              {
                text: 'HTML 和嵌入内容',
                items: [
                  {
                    text: 'HTML 内容',
                    link: 'html',
                  },
                  {
                    text: 'YouTube',
                    link: 'iframe',
                  },
                ],
              },
              {
                text: '协同',
                items: [
                  {
                    text: 'Loro',
                    link: 'loro',
                  },
                  {
                    text: 'Yjs',
                    link: 'yjs',
                  },
                  {
                    text: 'Liveblocks',
                    link: 'liveblocks',
                  },
                  {
                    text: '多人光标',
                    link: 'perfect-cursors',
                  },
                  {
                    text: '多人评论',
                    link: 'comments-overlay',
                  },
                ],
              },
            ],
          },
        ],
      },
      '/zh/experiment/': {
        base: '/zh/experiment/',
        items: [
          { text: '使用 WebGPU 绘制粒子', link: 'particles' },
          { text: '命令式创建渐变', link: 'gradient' },
          { text: '网格渐变生成器', link: 'mesh-gradient' },
          { text: 'Voronoi', link: 'voronoi' },
          { text: '分形布朗运动', link: 'fractal-brownian-motion' },
          { text: '域变形', link: 'domain-warping' },
          {
            text: '勾股定理',
            link: 'pythagorean-theorem',
          },
          { text: '一种字体生成艺术效果', link: 'signature' },
          { text: '当画布遇到 Chat', link: 'when-canvas-meets-chat' },
          {
            text: '在 WebWorker 中使用 SAM 进行图像分割',
            link: 'sam-in-worker',
          },
          {
            text: '在 WebWorker 中使用 LaMa 进行对象擦除',
            link: 'lama-in-worker',
          },
          { text: '音频可视化', link: 'audio-visualizer' },
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
