/**
 * SEO helpers for the VitePress site.
 *
 * Canonical URLs follow VitePress `cleanUrls` (no `.html`). hreflang alternates
 * are emitted only for locale files that actually exist, matching sitemap grouping.
 */

export const SITE_ORIGIN = 'https://infinitecanvas.cc';

export type SeoLocale = 'root' | 'zh' | 'zh-Hant' | 'ko' | 'ja' | 'es' | 'pt-BR';

export type SeoHeadTag = [string, Record<string, string>];

export interface SeoPageData {
  relativePath: string;
  title: string;
  description: string;
  frontmatter: {
    head?: SeoHeadTag[];
    [key: string]: unknown;
  };
}

export interface SeoSiteConfig {
  pages: string[];
  cleanUrls?: boolean;
  rewrites?: { map?: Record<string, string | undefined> };
}

export interface SitemapLink {
  url: string;
  lang?: string;
}

export interface SitemapEntry {
  url: string;
  links?: SitemapLink[];
  [key: string]: unknown;
}

/** HTML hreflang / VitePress `lang` values. */
export const HREFLANG: Record<SeoLocale, string> = {
  root: 'en-US',
  zh: 'zh-Hans',
  'zh-Hant': 'zh-Hant',
  ko: 'ko-KR',
  ja: 'ja-JP',
  es: 'es-ES',
  'pt-BR': 'pt-BR',
};

/** Open Graph locale uses underscore language_TERRITORY tags. */
export const OG_LOCALE: Record<SeoLocale, string> = {
  root: 'en_US',
  zh: 'zh_CN',
  // Open Graph has no script-only tag; zh_TW is the Traditional Chinese locale.
  'zh-Hant': 'zh_TW',
  ko: 'ko_KR',
  ja: 'ja_JP',
  es: 'es_ES',
  'pt-BR': 'pt_BR',
};

/** Locale `<title>` used when a page has no heading of its own (home, some API pages). */
export const LOCALE_TITLE: Record<SeoLocale, string> = {
  root: 'An infinite canvas tutorial',
  zh: '一个无限画布教程',
  'zh-Hant': '一個無限畫布教程',
  ko: '무한 캔버스 튜토리얼',
  ja: '無限キャンバスチュートリアル',
  es: 'Un tutorial de lienzo infinito',
  'pt-BR': 'Um tutorial de tela infinita',
};

/**
 * Pages that are build artifacts or orphan drafts, not documents we want indexed.
 * - collaboration/README.md is an internal note, not a lesson
 * - zh/guide/lesson-040.md is an unlinked stub (EN guide ends at lesson 39)
 * - experiment/lottie-player.md is an empty file with no sidebar entry
 */
const NOINDEX_SOURCE = new Set([
  'collaboration/README.md',
  'zh/guide/lesson-040.md',
  'experiment/lottie-player.md',
]);

export function outputPath(
  sourcePath: string,
  rewrites?: SeoSiteConfig['rewrites'],
): string {
  return rewrites?.map?.[sourcePath] || sourcePath;
}

const LOCALE_DIRS = new Set<SeoLocale>([
  'zh',
  'zh-Hant',
  'ko',
  'ja',
  'es',
  'pt-BR',
]);

export function localeOf(relativePath: string): SeoLocale {
  const prefix = relativePath.split('/')[0] as SeoLocale;
  if (LOCALE_DIRS.has(prefix)) return prefix;
  return 'root';
}

/** Path with the locale prefix removed, matching VitePress sitemap grouping. */
export function pageKey(relativePath: string): string {
  const locale = localeOf(relativePath);
  if (locale === 'root') return relativePath;
  return relativePath.slice(locale.length + 1);
}

export function withLocale(key: string, locale: SeoLocale): string {
  if (locale === 'root') return key;
  return `${locale}/${key}`;
}

/**
 * Public URL for a source (or rewritten) markdown path.
 * Mirrors VitePress sitemap generation when `cleanUrls` is on:
 * `index.md` → `/`, `zh/index.md` → `/zh/`, `guide/lesson-001.md` → `/guide/lesson-001`.
 */
export function canonicalUrl(relativePath: string, cleanUrls: boolean): string {
  let url = relativePath.replace(/(^|\/)index\.md$/, '$1');
  url = url.replace(/\.md$/, cleanUrls ? '' : '.html');
  if (url === '') return `${SITE_ORIGIN}/`;
  return `${SITE_ORIGIN}/${url}`;
}

export function isNoindexSource(relativePath: string): boolean {
  return NOINDEX_SOURCE.has(relativePath);
}

export function isSitemapNoise(url: string): boolean {
  const path = url
    .replace(SITE_ORIGIN, '')
    .replace(/^\//, '')
    .replace(/\.html$/, '');
  return (
    path === 'collaboration/README' ||
    /(?:^|\/)guide\/lesson-040$/.test(path) ||
    /(?:^|\/)experiment\/lottie-player$/.test(path)
  );
}

export interface HreflangAlternate {
  locale: SeoLocale;
  hreflang: string;
  href: string;
}

export function hreflangAlternates(
  relativePath: string,
  site: SeoSiteConfig,
): HreflangAlternate[] {
  const key = pageKey(outputPath(relativePath, site.rewrites));
  const published = new Set(
    site.pages.map((page) => outputPath(page, site.rewrites)),
  );
  const cleanUrls = site.cleanUrls === true;
  const found: HreflangAlternate[] = [];
  for (const locale of ['root', 'zh', 'zh-Hant', 'ko', 'ja', 'es', 'pt-BR'] as const) {
    const source = withLocale(key, locale);
    if (!published.has(source)) continue;
    if (isNoindexSource(source)) continue;
    found.push({
      locale,
      hreflang: HREFLANG[locale],
      href: canonicalUrl(source, cleanUrls),
    });
  }
  return found;
}

function metaContent(
  head: SeoHeadTag[] | undefined,
  attr: 'property' | 'name',
  key: string,
): string | undefined {
  const tag = head?.find(
    (entry) => entry[0] === 'meta' && entry[1]?.[attr] === key,
  );
  const content = tag?.[1]?.content;
  return content?.trim() ? content : undefined;
}

function stripManagedHead(head: SeoHeadTag[]): SeoHeadTag[] {
  return head.filter((entry) => {
    const [tag, attrs] = entry;
    if (tag === 'link') {
      if (attrs.rel === 'canonical') return false;
      if (attrs.rel === 'alternate' && attrs.hreflang) return false;
    }
    if (tag === 'meta') {
      const property = attrs.property;
      const name = attrs.name;
      if (
        property === 'og:url' ||
        property === 'og:title' ||
        property === 'og:description' ||
        property === 'og:locale' ||
        property === 'og:locale:alternate'
      ) {
        return false;
      }
      if (name === 'twitter:title' || name === 'twitter:description')
        return false;
      if (name === 'robots' && attrs.content === 'noindex') return false;
    }
    return true;
  });
}

export function applyPageSeo(pageData: SeoPageData, site: SeoSiteConfig): void {
  const cleanUrls = site.cleanUrls === true;
  const rewritten = outputPath(pageData.relativePath, site.rewrites);
  const href = canonicalUrl(rewritten, cleanUrls);
  const locale = localeOf(rewritten);
  const existing = pageData.frontmatter.head ?? [];
  const ogTitle =
    metaContent(existing, 'property', 'og:title') ||
    pageData.title?.trim() ||
    LOCALE_TITLE[locale];
  const description = pageData.description?.trim() ?? '';
  const head = stripManagedHead(existing);

  head.push(['link', { rel: 'canonical', href }]);

  const alternates = hreflangAlternates(pageData.relativePath, site);
  if (alternates.length >= 2) {
    for (const alternate of alternates) {
      head.push([
        'link',
        {
          rel: 'alternate',
          hreflang: alternate.hreflang,
          href: alternate.href,
        },
      ]);
    }
    const fallback =
      alternates.find((alternate) => alternate.locale === 'root') ??
      alternates[0];
    head.push([
      'link',
      { rel: 'alternate', hreflang: 'x-default', href: fallback.href },
    ]);
    for (const alternate of alternates) {
      if (alternate.locale === locale) continue;
      head.push([
        'meta',
        {
          id: `og-locale-${alternate.locale}`,
          property: 'og:locale:alternate',
          content: OG_LOCALE[alternate.locale],
        },
      ]);
    }
  }

  head.push(['meta', { property: 'og:locale', content: OG_LOCALE[locale] }]);
  head.push(['meta', { property: 'og:url', content: href }]);
  head.push(['meta', { property: 'og:title', content: ogTitle }]);
  head.push(['meta', { property: 'og:description', content: description }]);
  head.push(['meta', { name: 'twitter:title', content: ogTitle }]);
  head.push(['meta', { name: 'twitter:description', content: description }]);

  if (isNoindexSource(pageData.relativePath)) {
    head.push(['meta', { name: 'robots', content: 'noindex' }]);
  }

  pageData.frontmatter.head = head;
}

export function filterSitemapItems<T extends SitemapEntry>(items: T[]): T[] {
  const kept: T[] = [];
  for (const item of items) {
    if (isSitemapNoise(item.url)) continue;
    if (!item.links) {
      kept.push(item);
      continue;
    }
    const links = item.links.filter((link) => !isSitemapNoise(link.url));
    kept.push({
      ...item,
      links: links.length >= 2 ? links : undefined,
    });
  }
  return kept;
}
