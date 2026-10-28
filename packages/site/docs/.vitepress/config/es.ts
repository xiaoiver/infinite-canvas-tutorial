import { defineConfig } from 'vitepress';

export const es = defineConfig({
  lang: 'es-ES',
  title: 'Un tutorial de lienzo infinito',
  description:
    'Un tutorial de código abierto y en profundidad para construir un lienzo infinito con HTML5 Canvas, WebGL/WebGPU, ECS, renderizado SDF y colaboración mediante CRDT/Yjs, y crear espacios de trabajo interactivos como Figma.',
  keywords: [
    'lienzo infinito',
    'canvas',
    'webgl',
    'webgpu',
    'ecs',
  ],
  themeConfig: {
    nav: [
      { text: 'App', link: 'https://app.infinitecanvas.cc/' },
      {
        text: 'Guía',
        link: '/es/guide/lesson-001',
        activeMatch: '/es/guide/',
      },
      // Example, reference, and experiment pages are not translated.
      // These links open the English locale so the sidebar never 404s.
      { text: 'Ejemplos (EN)', link: '/example/solar-system' },
      { text: 'Referencia (EN)', link: '/reference/canvas' },
      { text: 'Experimentos (EN)', link: '/experiment/particles' },
    ],

    sidebar: {
      '/es/guide/': {
        base: '/es/guide/',
        items: [
          {
            text: 'Introducción',
            items: [
              {
                text: '¿Qué es un lienzo infinito?',
                link: 'what-is-an-infinite-canvas',
              },
            ],
          },
          {
            text: 'Lecciones',
            items: [
              {
                text: 'Lección 001 - Inicializar el lienzo',
                link: 'lesson-001',
              },
              {
                text: 'Lección 002 - Dibujar un círculo',
                link: 'lesson-002',
              },
              {
                text: 'Lección 003 - Grafo de escena y transformaciones',
                link: 'lesson-003',
              },
              {
                text: 'Lección 004 - Cámara',
                link: 'lesson-004',
              },
              {
                text: 'Lección 005 - Cuadrícula',
                link: 'lesson-005',
              },
              {
                text: 'Lección 006 - Sistema de eventos',
                link: 'lesson-006',
              },
              {
                text: 'Lección 007 - Web UI',
                link: 'lesson-007',
              },
              {
                text: 'Lección 008 - Optimizar el rendimiento',
                link: 'lesson-008',
              },
              {
                text: 'Lección 009 - Dibujar elipses y rectángulos',
                link: 'lesson-009',
              },
              {
                text: 'Lección 010 - Importar y exportar imágenes',
                link: 'lesson-010',
              },
              {
                text: 'Lección 011 - Pruebas y renderizado en el servidor',
                link: 'lesson-011',
              },
              {
                text: 'Lección 012 - Dibujar polilíneas',
                link: 'lesson-012',
              },
              {
                text: 'Lección 013 - Dibujar trazados y estilo de boceto',
                link: 'lesson-013',
              },
              {
                text: 'Lección 014 - Modo del lienzo e interfaz auxiliar',
                link: 'lesson-014',
              },
              {
                text: 'Lección 015 - Renderizado de texto',
                link: 'lesson-015',
              },
              {
                text: 'Lección 016 - Funciones avanzadas de texto',
                link: 'lesson-016',
              },
              {
                text: 'Lección 017 - Degradados y patrones',
                link: 'lesson-017',
              },
              {
                text: 'Lección 018 - Refactorizar con ECS',
                link: 'lesson-018',
              },
              {
                text: 'Lección 019 - Historial',
                link: 'lesson-019',
              },
              {
                text: 'Lección 020 - Colaboración',
                link: 'lesson-020',
              },
              {
                text: 'Lección 021 - Transformer',
                link: 'lesson-021',
              },
              {
                text: 'Lección 022 - VectorNetwork',
                link: 'lesson-022',
              },
              {
                text: 'Lección 023 - Mapa mental',
                link: 'lesson-023',
              },
              {
                text: 'Lección 024 - Menú contextual y portapapeles',
                link: 'lesson-024',
              },
              {
                text: 'Lección 025 - Modo de dibujo y pincel',
                link: 'lesson-025',
              },
              {
                text: 'Lección 026 - Herramienta de selección',
                link: 'lesson-026',
              },
              {
                text: 'Lección 027 - Ajuste y alineación',
                link: 'lesson-027',
              },
              {
                text: 'Lección 028 - Integración con IA',
                link: 'lesson-028',
              },
              {
                text: 'Lección 029 - Incrustar contenido HTML',
                link: 'lesson-029',
              },
              {
                text: 'Lección 030 - Posprocesado y grafo de renderizado',
                link: 'lesson-030',
              },
              {
                text: 'Lección 031 - Enlaces entre formas',
                link: 'lesson-031',
              },
              {
                text: 'Lección 032 - De texto a diagrama',
                link: 'lesson-032',
              },
              {
                text: 'Lección 033 - Motor de layout',
                link: 'lesson-033',
              },
              {
                text: 'Lección 034 - Group, Frame y recorte',
                link: 'lesson-034',
              },
              {
                text: 'Lección 035 - Renderizado basado en teselas',
                link: 'lesson-035',
              },
              {
                text: 'Lección 036 - Animación',
                link: 'lesson-036',
              },
              {
                text: 'Lección 037 - GI con Radiance Cascades',
                link: 'lesson-037',
              },
              {
                text: 'Lección 038 - Del diseño al código',
                link: 'lesson-038',
              },
              {
                text: 'Lección 039 - Renderizado de mallas 3D',
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
      text: 'Editar esta página en GitHub',
    },

    docFooter: {
      prev: 'Página anterior',
      next: 'Página siguiente',
    },

    outline: {
      label: 'En esta página',
    },

    lastUpdated: {
      text: 'Última actualización',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'medium',
      },
    },

    langMenuLabel: 'Idioma',
    returnToTopLabel: 'Volver arriba',
    sidebarMenuLabel: 'Menú',
    darkModeSwitchLabel: 'Tema',
    lightModeSwitchTitle: 'Cambiar a modo claro',
    darkModeSwitchTitle: 'Cambiar a modo oscuro',
  },
});

export const search = {
  placeholder: 'Buscar en la documentación',
  translations: {
    button: {
      buttonText: 'Buscar en la documentación',
      buttonAriaLabel: 'Buscar en la documentación',
    },
    modal: {
      searchBox: {
        resetButtonTitle: 'Borrar la consulta',
        resetButtonAriaLabel: 'Borrar la consulta',
        cancelButtonText: 'Cancelar',
        cancelButtonAriaLabel: 'Cancelar',
      },
      startScreen: {
        recentSearchesTitle: 'Búsquedas recientes',
        noRecentSearchesText: 'No hay búsquedas recientes',
        saveRecentSearchButtonTitle: 'Guardar en búsquedas recientes',
        removeRecentSearchButtonTitle: 'Quitar de búsquedas recientes',
        favoriteSearchesTitle: 'Favoritos',
        removeFavoriteSearchButtonTitle: 'Quitar de favoritos',
      },
      errorScreen: {
        titleText: 'No se pueden obtener resultados',
        helpText: 'Comprueba tu conexión de red',
      },
      footer: {
        selectText: 'Seleccionar',
        navigateText: 'Navegar',
        closeText: 'Cerrar',
        searchByText: 'Búsqueda por',
      },
      noResultsScreen: {
        noResultsText: 'No hay resultados relacionados',
        suggestedQueryText: 'Puedes probar con',
        reportMissingResultsText: '¿Crees que esta consulta debería tener resultados?',
        reportMissingResultsLinkText: 'Enviar comentarios',
      },
    },
  },
};
