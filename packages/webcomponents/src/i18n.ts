import { configureLocalization } from '@lit/localize';
// Generated via output.localeCodesModule
import { sourceLocale, targetLocales } from './generated/locale-codes';

// Use static imports to load all locales at once for simplicity.
// You can also use dynamic imports to load locales on demand, which will be more efficient for large applications.
// https://lit.dev/docs/localization/runtime-mode/#static-imports
import * as templates_es_419 from './generated/locales/es-419';
import * as templates_zh_hans from './generated/locales/zh-Hans';

const localizedTemplates = new Map([
  ['es-419', templates_es_419],
  ['zh-Hans', templates_zh_hans],
]);

export const { getLocale, setLocale } = configureLocalization({
  sourceLocale,
  targetLocales,
  loadLocale: async (locale) => localizedTemplates.get(locale),
});

// export const { getLocale, setLocale } = configureLocalization({
//   sourceLocale,
//   targetLocales,
//   loadLocale: (locale) => import(`/locales/${locale}.js`),
// });
