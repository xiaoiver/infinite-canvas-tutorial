export * from './plugin';

import { localizedTemplates } from '@infinite-canvas-tutorial/webcomponents';

import * as templates_zh_hans from './generated/locales/zh-Hans';
import * as templates_es_419 from './generated/locales/es-419';

localizedTemplates.set('es-419', {
  templates: {
    ...localizedTemplates.get('es-419').templates,
    ...templates_es_419.templates,
  },
});
localizedTemplates.set('zh-Hans', {
  templates: {
    ...localizedTemplates.get('zh-Hans').templates,
    ...templates_zh_hans.templates,
  },
});

// declare module '@infinite-canvas-tutorial/ecs' {
//   interface AppState {
//     lassoMode: 'draw' | 'select';
//     lassoTrailStroke: string;
//     lassoTrailFill: string;
//     lassoTrailFillOpacity: number;
//     lassoTrailStrokeDasharray: string;
//     lassoTrailStrokeDashoffset: string;
//   }
// }
