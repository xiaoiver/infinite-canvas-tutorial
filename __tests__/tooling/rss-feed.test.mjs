import assert from 'node:assert/strict';
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CLOUDFLARE_PAGES_MAX_FILE_BYTES,
  RSS_SUMMARY_MAX_CHARS,
  assertRssFeedFileWithinPagesLimit,
  assertRssFeedWithinPagesLimit,
  rssItemSummary,
  rssPluginOptions,
} from '../../packages/site/docs/.vitepress/config/rss-feed.mjs';

const docsDir = fileURLToPath(
  new URL('../../packages/site/docs/', import.meta.url),
);

test('rss feed stays on bounded summaries', () => {
  assert.equal(rssPluginOptions.renderHTML, false);
  assert.equal(
    rssPluginOptions.renderExpect('ignored body', {
      description: 'x'.repeat(RSS_SUMMARY_MAX_CHARS + 80),
    }).length,
    RSS_SUMMARY_MAX_CHARS,
  );

  const summary = rssItemSummary(
    'Intro sentence.\n\n```js\nconst secret = "x".repeat(8000);\n```\n\nAfter the sample.',
    { description: '' },
  );
  assert.equal(summary.includes('secret'), false);
  assert.match(summary, /^Intro sentence\./);
  assert.equal(
    rssItemSummary('```js\nsecret\n```', { description: 'Public summary' }),
    'Public summary',
  );
});

test('pages limit check rejects a 25 MiB feed without writing one', () => {
  assert.throws(
    () => assertRssFeedWithinPagesLimit(CLOUDFLARE_PAGES_MAX_FILE_BYTES),
    /25 MiB/,
  );
  assert.equal(
    assertRssFeedWithinPagesLimit(CLOUDFLARE_PAGES_MAX_FILE_BYTES - 1),
    CLOUDFLARE_PAGES_MAX_FILE_BYTES - 1,
  );

  const dir = mkdtempSync(join(tmpdir(), 'ic-rss-'));
  try {
    writeFileSync(join(dir, 'feed.rss'), '<rss></rss>');
    assert.equal(assertRssFeedFileWithinPagesLimit(dir), 11);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('representative summary feed from the docs tree stays under 25 MiB', () => {
  const items = collectFeedItems(docsDir);
  assert.ok(items.length > 100, `expected the docs tree, got ${items.length}`);
  for (const item of items) {
    assert.ok(item.description.length <= RSS_SUMMARY_MAX_CHARS);
  }

  const xml = renderSummaryRss(items);
  const bytes = Buffer.byteLength(xml, 'utf8');
  // Headroom for more lessons and locales. Full HTML previously landed at ~37.7 MiB.
  const regressionBudget = 2 * 1024 * 1024;
  assert.ok(
    bytes < regressionBudget,
    `summary feed is ${bytes} bytes, expected under ${regressionBudget}`,
  );
  assert.ok(bytes < CLOUDFLARE_PAGES_MAX_FILE_BYTES);
  console.log(
    `representative feed.rss ${bytes} bytes (${(bytes / (1024 * 1024)).toFixed(
      3,
    )} MiB) from ${items.length} items`,
  );
});

function collectFeedItems(root) {
  const items = [];
  for (const file of walkMarkdown(root)) {
    const raw = readFileSync(file, 'utf8');
    const { data, body } = splitFrontmatter(raw);
    if (data.layout === 'home') continue;
    if (data.publish === 'false') continue;
    const rel = relative(root, file).split(sep).join('/');
    const description = rssPluginOptions.renderExpect(body, data);
    items.push({
      title: pageTitle(data, body, rel),
      link: pageLink(rel),
      description,
      image: enclosureUrl(data.cover || firstMarkdownImage(raw)),
    });
  }
  return items;
}

function walkMarkdown(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.vitepress') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkMarkdown(path));
    else if (entry.name.endsWith('.md')) files.push(path);
  }
  return files;
}

function splitFrontmatter(raw) {
  if (!raw.startsWith('---')) return { data: {}, body: raw };
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return { data: {}, body: raw };
  const data = {};
  for (const line of raw.slice(3, end).split(/\r?\n/)) {
    const match = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith("'") && value.endsWith("'")) ||
        (value.startsWith('"') && value.endsWith('"')))
    ) {
      value = value.slice(1, -1);
    }
    data[match[1]] = value;
  }
  return { data, body: raw.slice(end + 4).replace(/^\r?\n/, '') };
}

function pageTitle(data, body, rel) {
  if (data.title && data.title.trim()) return data.title.trim();
  const heading = /^#\s+(.+)$/m.exec(body);
  if (heading) return heading[1].trim();
  return rel;
}

function pageLink(rel) {
  const clean = rel.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '');
  return clean
    ? `https://infinitecanvas.cc/${clean}`
    : 'https://infinitecanvas.cc/';
}

/** RSS 2.0 envelope close to feed@4.2.2 with summaries and no content:encoded. */
function renderSummaryRss(items) {
  const header = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
    <channel>
        <title>An infinite canvas tutorial</title>
        <link>https://infinitecanvas.cc</link>
        <description>${rssPluginOptions.description}</description>
        <lastBuildDate>Thu, 29 Oct 2026 00:00:00 GMT</lastBuildDate>
        <docs>https://validator.w3.org/feed/docs/rss2.html</docs>
        <generator>https://github.com/jpmonette/feed</generator>
        <copyright>Copyright (c) 2024-present xiaoiver</copyright>
`;
  const body = items
    .map(
      (item) => `        <item>
            <title><![CDATA[${cdata(item.title)}]]></title>
            <link>${item.link}</link>
            <guid>${item.link}</guid>
            <pubDate>Thu, 29 Oct 2026 00:00:00 GMT</pubDate>
            <description><![CDATA[${cdata(item.description)}]]></description>${
        item.image
          ? `\n            <enclosure url="${
              item.image
            }" length="0" type="image/${extensionOf(item.image)}"/>`
          : ''
      }
        </item>`,
    )
    .join('\n');
  return `${header}${body}\n    </channel>\n</rss>\n`;
}

function cdata(value) {
  return value.replaceAll(']]>', ']]]]><![CDATA[>');
}

/** Same first-image enclosure `vitepress-plugin-rss` adds from Markdown. */
function firstMarkdownImage(raw) {
  return /!\[.*?\]\((.*?)\s*(".*?")?\)/.exec(raw)?.[1] ?? '';
}

function enclosureUrl(cover) {
  if (!cover) return '';
  try {
    return new URL(cover, 'https://infinitecanvas.cc').href;
  } catch {
    return cover;
  }
}

function extensionOf(url) {
  return new URL(url).pathname.split('.').slice(-1)[0];
}
