import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
    // A list of all locales that are supported
    locales: ['en', 'zh-Hans', 'es-419'],

    // Used when no locale matches
    defaultLocale: 'en',

    // 始终在路由中显示 locale 前缀
    localePrefix: 'always'
});

