import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyPageSeo,
  canonicalUrl,
  filterSitemapItems,
  hreflangAlternates,
  type SeoPageData,
  type SeoSiteConfig,
} from './seo.ts';

const pages = [
  'index.md',
  'zh/index.md',
  'ko/index.md',
  'guide/lesson-001.md',
  'zh/guide/lesson-001.md',
  'ko/guide/lesson-001.md',
  'guide/lesson-005.md',
  'zh/guide/lesson-005.md',
  'zh/guide/lesson-040.md',
  'collaboration/README.md',
  'experiment/lottie-player.md',
  'reference/canvas.md',
];

const site: SeoSiteConfig = { pages, cleanUrls: true };

function page(
  relativePath: string,
  title: string,
  description: string,
): SeoPageData {
  return {
    relativePath,
    title,
    description,
    frontmatter: {},
  };
}

describe('canonicalUrl', () => {
  it('uses extensionless clean URLs and keeps index trailing slashes', () => {
    assert.equal(canonicalUrl('index.md', true), 'https://infinitecanvas.cc/');
    assert.equal(
      canonicalUrl('zh/index.md', true),
      'https://infinitecanvas.cc/zh/',
    );
    assert.equal(
      canonicalUrl('ko/index.md', true),
      'https://infinitecanvas.cc/ko/',
    );
    assert.equal(
      canonicalUrl('guide/lesson-001.md', true),
      'https://infinitecanvas.cc/guide/lesson-001',
    );
    assert.equal(
      canonicalUrl('zh/guide/lesson-001.md', true),
      'https://infinitecanvas.cc/zh/guide/lesson-001',
    );
  });

  it('keeps .html only when cleanUrls is off', () => {
    assert.equal(
      canonicalUrl('guide/lesson-001.md', false),
      'https://infinitecanvas.cc/guide/lesson-001.html',
    );
  });
});

describe('hreflangAlternates', () => {
  it('includes Korean only when that lesson exists', () => {
    const lesson1 = hreflangAlternates('guide/lesson-001.md', site).map(
      (item) => item.hreflang,
    );
    assert.deepEqual(lesson1, ['en-US', 'zh-Hans', 'ko-KR']);

    const lesson5 = hreflangAlternates('zh/guide/lesson-005.md', site).map(
      (item) => item.hreflang,
    );
    assert.deepEqual(lesson5, ['en-US', 'zh-Hans']);
  });

  it('does not advertise the orphan zh lesson-040', () => {
    assert.deepEqual(hreflangAlternates('zh/guide/lesson-040.md', site), []);
  });

  it('includes Japanese only when that page exists', () => {
    const withJa: SeoSiteConfig = {
      ...site,
      pages: [...pages, 'ja/index.md', 'ja/guide/lesson-001.md'],
    };
    assert.deepEqual(
      hreflangAlternates('guide/lesson-001.md', withJa).map(
        (item) => item.hreflang,
      ),
      ['en-US', 'zh-Hans', 'ko-KR', 'ja-JP'],
    );
    assert.deepEqual(
      hreflangAlternates('ja/index.md', withJa).map((item) => item.href),
      [
        'https://infinitecanvas.cc/',
        'https://infinitecanvas.cc/zh/',
        'https://infinitecanvas.cc/ko/',
        'https://infinitecanvas.cc/ja/',
      ],
    );
    const lesson5 = hreflangAlternates('guide/lesson-005.md', withJa).map(
      (item) => item.hreflang,
    );
    assert.deepEqual(lesson5, ['en-US', 'zh-Hans']);
  });
});

describe('applyPageSeo', () => {
  it('sets per-page canonical, locale, and social tags', () => {
    const data = page(
      'zh/index.md',
      '一个无限画布教程',
      '一个开源的无限画布教程',
    );
    data.frontmatter.head = [
      ['meta', { property: 'og:title', content: '自定义标题' }],
    ];
    applyPageSeo(data, site);
    const head = data.frontmatter.head ?? [];
    const find = (tag: string, key: string, value: string) =>
      head.find((entry) => entry[0] === tag && entry[1][key] === value);

    assert.equal(
      find('link', 'rel', 'canonical')?.[1].href,
      'https://infinitecanvas.cc/zh/',
    );
    assert.equal(
      find('meta', 'property', 'og:url')?.[1].content,
      'https://infinitecanvas.cc/zh/',
    );
    assert.equal(find('meta', 'property', 'og:locale')?.[1].content, 'zh_CN');
    assert.equal(
      find('meta', 'property', 'og:title')?.[1].content,
      '自定义标题',
    );
    assert.equal(
      find('meta', 'property', 'og:description')?.[1].content,
      '一个开源的无限画布教程',
    );
    assert.equal(
      find('meta', 'name', 'twitter:title')?.[1].content,
      '自定义标题',
    );
    assert.equal(
      find('meta', 'name', 'twitter:description')?.[1].content,
      '一个开源的无限画布教程',
    );
    const langs = head
      .filter((entry) => entry[0] === 'link' && entry[1].rel === 'alternate')
      .map((entry) => entry[1].hreflang);
    assert.deepEqual(langs, ['en-US', 'zh-Hans', 'ko-KR', 'x-default']);
    assert.equal(
      head.find((entry) => entry[1].hreflang === 'x-default')?.[1].href,
      'https://infinitecanvas.cc/',
    );
  });

  it('uses the locale title when the page has no heading', () => {
    const data = page('zh/index.md', '', '中文简介');
    applyPageSeo(data, site);
    const ogTitle = data.frontmatter.head?.find(
      (entry) => entry[1].property === 'og:title',
    );
    assert.equal(ogTitle?.[1].content, '一个无限画布教程');
  });

  it('is idempotent and noindexes orphan pages', () => {
    const data = page(
      'collaboration/README.md',
      'Collaboration examples',
      'notes',
    );
    applyPageSeo(data, site);
    applyPageSeo(data, site);
    const head = data.frontmatter.head ?? [];
    const canonicals = head.filter((entry) => entry[1].rel === 'canonical');
    assert.equal(canonicals.length, 1);
    assert.equal(
      head.find((entry) => entry[1].name === 'robots')?.[1].content,
      'noindex',
    );
    assert.equal(
      head.find((entry) => entry[1].property === 'og:locale')?.[1].content,
      'en_US',
    );
  });
});

describe('filterSitemapItems', () => {
  it('drops noise and strips those URLs out of alternates', () => {
    const items = filterSitemapItems([
      { url: 'collaboration/README' },
      { url: 'zh/guide/lesson-040' },
      { url: 'experiment/lottie-player' },
      {
        url: 'guide/lesson-001',
        links: [
          { url: 'guide/lesson-001', lang: 'en-US' },
          { url: 'ko/guide/lesson-001', lang: 'ko-KR' },
          { url: 'zh/guide/lesson-040', lang: 'zh-Hans' },
        ],
      },
      { url: 'reference/canvas' },
    ]);
    assert.deepEqual(
      items.map((item) => item.url),
      ['guide/lesson-001', 'reference/canvas'],
    );
    assert.deepEqual(items[0].links, [
      { url: 'guide/lesson-001', lang: 'en-US' },
      { url: 'ko/guide/lesson-001', lang: 'ko-KR' },
    ]);
  });
});

describe('new guide locales', () => {
  const withNew: SeoSiteConfig = {
    ...site,
    pages: [
      ...pages,
      'zh-Hant/index.md',
      'zh-Hant/guide/lesson-001.md',
      'es/index.md',
      'es/guide/lesson-001.md',
      'pt-BR/index.md',
      'pt-BR/guide/lesson-001.md',
    ],
  };

  it('builds clean canonical URLs for hyphenated locale folders', () => {
    assert.equal(
      canonicalUrl('zh-Hant/index.md', true),
      'https://infinitecanvas.cc/zh-Hant/',
    );
    assert.equal(
      canonicalUrl('pt-BR/guide/lesson-001.md', true),
      'https://infinitecanvas.cc/pt-BR/guide/lesson-001',
    );
    assert.equal(
      canonicalUrl('es/guide/lesson-001.md', true),
      'https://infinitecanvas.cc/es/guide/lesson-001',
    );
  });

  it('advertises Traditional Chinese, Spanish, and Brazilian Portuguese when the page exists', () => {
    assert.deepEqual(
      hreflangAlternates('guide/lesson-001.md', withNew).map(
        (item) => item.hreflang,
      ),
      ['en-US', 'zh-Hans', 'zh-Hant', 'ko-KR', 'es-ES', 'pt-BR'],
    );
    assert.deepEqual(
      hreflangAlternates('pt-BR/index.md', withNew).map((item) => item.href),
      [
        'https://infinitecanvas.cc/',
        'https://infinitecanvas.cc/zh/',
        'https://infinitecanvas.cc/zh-Hant/',
        'https://infinitecanvas.cc/ko/',
        'https://infinitecanvas.cc/es/',
        'https://infinitecanvas.cc/pt-BR/',
      ],
    );
  });

  it('sets Open Graph locales for the new languages', () => {
    const cases = [
      ['zh-Hant/index.md', '一個無限畫布教程', 'zh_TW'],
      ['es/index.md', 'Un tutorial de lienzo infinito', 'es_ES'],
      ['pt-BR/index.md', 'Um tutorial de tela infinita', 'pt_BR'],
    ] as const;
    for (const [path, title, og] of cases) {
      const data = page(path, '', 'desc');
      applyPageSeo(data, withNew);
      const locale = data.frontmatter.head?.find(
        (entry) => entry[1].property === 'og:locale',
      );
      const ogTitle = data.frontmatter.head?.find(
        (entry) => entry[1].property === 'og:title',
      );
      assert.equal(locale?.[1].content, og);
      assert.equal(ogTitle?.[1].content, title);
    }
  });
});

