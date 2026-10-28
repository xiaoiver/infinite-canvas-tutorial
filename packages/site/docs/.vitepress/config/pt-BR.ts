import { defineConfig } from 'vitepress';

export const ptBR = defineConfig({
  lang: 'pt-BR',
  title: 'Um tutorial de tela infinita',
  description:
    'Um tutorial de código aberto e aprofundado para construir uma tela infinita com HTML5 Canvas, WebGL/WebGPU, ECS, renderização SDF e colaboração via CRDT/Yjs, e criar espaços de trabalho interativos como o Figma.',
  keywords: [
    'tela infinita',
    'canvas',
    'webgl',
    'webgpu',
    'ecs',
  ],
  themeConfig: {
    nav: [
      { text: 'App', link: 'https://app.infinitecanvas.cc/' },
      {
        text: 'Guia',
        link: '/pt-BR/guide/lesson-001',
        activeMatch: '/pt-BR/guide/',
      },
      // Example, reference, and experiment pages are not translated.
      // These links open the English locale so the sidebar never 404s.
      { text: 'Exemplos (EN)', link: '/example/solar-system' },
      { text: 'Referência (EN)', link: '/reference/canvas' },
      { text: 'Experimentos (EN)', link: '/experiment/particles' },
    ],

    sidebar: {
      '/pt-BR/guide/': {
        base: '/pt-BR/guide/',
        items: [
          {
            text: 'Introdução',
            items: [
              {
                text: 'O que é uma tela infinita?',
                link: 'what-is-an-infinite-canvas',
              },
            ],
          },
          {
            text: 'Lições',
            items: [
              {
                text: 'Lição 001 - Inicializar a tela',
                link: 'lesson-001',
              },
              {
                text: 'Lição 002 - Desenhar um círculo',
                link: 'lesson-002',
              },
              {
                text: 'Lição 003 - Grafo de cena e transformações',
                link: 'lesson-003',
              },
              {
                text: 'Lição 004 - Câmera',
                link: 'lesson-004',
              },
              {
                text: 'Lição 005 - Grade',
                link: 'lesson-005',
              },
              {
                text: 'Lição 006 - Sistema de eventos',
                link: 'lesson-006',
              },
              {
                text: 'Lição 007 - Web UI',
                link: 'lesson-007',
              },
              {
                text: 'Lição 008 - Otimizar o desempenho',
                link: 'lesson-008',
              },
              {
                text: 'Lição 009 - Desenhar elipses e retângulos',
                link: 'lesson-009',
              },
              {
                text: 'Lição 010 - Importar e exportar imagens',
                link: 'lesson-010',
              },
              {
                text: 'Lição 011 - Testes e renderização no servidor',
                link: 'lesson-011',
              },
              {
                text: 'Lição 012 - Desenhar polilinhas',
                link: 'lesson-012',
              },
              {
                text: 'Lição 013 - Desenhar caminhos e estilo de esboço',
                link: 'lesson-013',
              },
              {
                text: 'Lição 014 - Modo da tela e UI auxiliar',
                link: 'lesson-014',
              },
              {
                text: 'Lição 015 - Renderização de texto',
                link: 'lesson-015',
              },
              {
                text: 'Lição 016 - Recursos avançados de texto',
                link: 'lesson-016',
              },
              {
                text: 'Lição 017 - Gradientes e padrões',
                link: 'lesson-017',
              },
              {
                text: 'Lição 018 - Refatorar com ECS',
                link: 'lesson-018',
              },
              {
                text: 'Lição 019 - Histórico',
                link: 'lesson-019',
              },
              {
                text: 'Lição 020 - Colaboração',
                link: 'lesson-020',
              },
              {
                text: 'Lição 021 - Transformer',
                link: 'lesson-021',
              },
              {
                text: 'Lição 022 - VectorNetwork',
                link: 'lesson-022',
              },
              {
                text: 'Lição 023 - Mapa mental',
                link: 'lesson-023',
              },
              {
                text: 'Lição 024 - Menu de contexto e área de transferência',
                link: 'lesson-024',
              },
              {
                text: 'Lição 025 - Modo de desenho e pincel',
                link: 'lesson-025',
              },
              {
                text: 'Lição 026 - Ferramenta de seleção',
                link: 'lesson-026',
              },
              {
                text: 'Lição 027 - Ajuste e alinhamento',
                link: 'lesson-027',
              },
              {
                text: 'Lição 028 - Integração com IA',
                link: 'lesson-028',
              },
              {
                text: 'Lição 029 - Incorporar conteúdo HTML',
                link: 'lesson-029',
              },
              {
                text: 'Lição 030 - Pós-processamento e grafo de renderização',
                link: 'lesson-030',
              },
              {
                text: 'Lição 031 - Vínculos entre formas',
                link: 'lesson-031',
              },
              {
                text: 'Lição 032 - De texto a diagrama',
                link: 'lesson-032',
              },
              {
                text: 'Lição 033 - Motor de layout',
                link: 'lesson-033',
              },
              {
                text: 'Lição 034 - Group, Frame e recorte',
                link: 'lesson-034',
              },
              {
                text: 'Lição 035 - Renderização baseada em blocos',
                link: 'lesson-035',
              },
              {
                text: 'Lição 036 - Animação',
                link: 'lesson-036',
              },
              {
                text: 'Lição 037 - GI com Radiance Cascades',
                link: 'lesson-037',
              },
              {
                text: 'Lição 038 - Do design ao código',
                link: 'lesson-038',
              },
              {
                text: 'Lição 039 - Renderização de malhas 3D',
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
      text: 'Editar esta página no GitHub',
    },

    docFooter: {
      prev: 'Página anterior',
      next: 'Próxima página',
    },

    outline: {
      label: 'Nesta página',
    },

    lastUpdated: {
      text: 'Última atualização',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'medium',
      },
    },

    langMenuLabel: 'Idioma',
    returnToTopLabel: 'Voltar ao topo',
    sidebarMenuLabel: 'Menu',
    darkModeSwitchLabel: 'Tema',
    lightModeSwitchTitle: 'Mudar para o modo claro',
    darkModeSwitchTitle: 'Mudar para o modo escuro',
  },
});

export const search = {
  placeholder: 'Pesquisar na documentação',
  translations: {
    button: {
      buttonText: 'Pesquisar na documentação',
      buttonAriaLabel: 'Pesquisar na documentação',
    },
    modal: {
      searchBox: {
        resetButtonTitle: 'Limpar a consulta',
        resetButtonAriaLabel: 'Limpar a consulta',
        cancelButtonText: 'Cancelar',
        cancelButtonAriaLabel: 'Cancelar',
      },
      startScreen: {
        recentSearchesTitle: 'Pesquisas recentes',
        noRecentSearchesText: 'Nenhuma pesquisa recente',
        saveRecentSearchButtonTitle: 'Salvar nas pesquisas recentes',
        removeRecentSearchButtonTitle: 'Remover das pesquisas recentes',
        favoriteSearchesTitle: 'Favoritos',
        removeFavoriteSearchButtonTitle: 'Remover dos favoritos',
      },
      errorScreen: {
        titleText: 'Não foi possível obter resultados',
        helpText: 'Verifique sua conexão de rede',
      },
      footer: {
        selectText: 'Selecionar',
        navigateText: 'Navegar',
        closeText: 'Fechar',
        searchByText: 'Pesquisa por',
      },
      noResultsScreen: {
        noResultsText: 'Nenhum resultado relacionado',
        suggestedQueryText: 'Você pode tentar pesquisar',
        reportMissingResultsText: 'Acha que esta consulta deveria ter resultados?',
        reportMissingResultsLinkText: 'Enviar feedback',
      },
    },
  },
};
