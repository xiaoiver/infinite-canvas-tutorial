/**
 * Prepend bilingual title, meta description, and body copy to docs/example/*.md
 * Idempotent via HTML markers. Run from repo root:
 *   node packages/site/scripts/enrich-example-pages.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exampleIntros } from './example-intros-data.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsRoot = join(__dirname, '../docs');

function stripFrontmatter(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return { frontmatter: null, body: content };
  return { frontmatter: m[1], body: m[2] };
}

function needsInteractiveDemoHeading(body) {
  const t = body.trimStart();
  return t.startsWith('<script setup>');
}

function buildFrontmatter(locale, { title, description }) {
  const safeTitle = JSON.stringify(title);
  const safeDesc = JSON.stringify(description);
  return `---\ntitle: ${safeTitle}\ndescription: ${safeDesc}\n---\n\n`;
}

function enrichOne(filePath, slug, locale) {
  const intro = exampleIntros[slug]?.[locale];
  if (!intro) {
    console.warn(`Missing intro for ${slug} (${locale})`);
    return;
  }
  if (!existsSync(filePath)) {
    console.warn(`Missing file ${filePath}`);
    return;
  }

  let raw = readFileSync(filePath, 'utf8');
  const marker = `<!-- example-intro:${locale} -->`;

  if (raw.includes(marker)) {
    console.log(`skip (already enriched): ${filePath}`);
    return;
  }

  const { body } = stripFrontmatter(raw);
  if (body === null || body === undefined) {
    console.warn(`No frontmatter in ${filePath}`);
    return;
  }

  const heading = locale === 'zh' ? '## 交互示例' : '## Interactive demo';
  const head = buildFrontmatter(locale, intro);
  const introMd = `${marker}\n\n# ${intro.title}\n\n${intro.body.trim()}\n\n`;

  let main = body;
  if (needsInteractiveDemoHeading(body)) {
    main = `${introMd}${heading}\n\n${body.trimStart()}`;
  } else {
    main = `${introMd}${body.trimStart()}`;
  }

  writeFileSync(filePath, head + main, 'utf8');
  console.log(`ok: ${filePath}`);
}

const slugs = Object.keys(exampleIntros);
for (const slug of slugs) {
  enrichOne(join(docsRoot, 'example', `${slug}.md`), slug, 'en');
  enrichOne(join(docsRoot, 'zh/example', `${slug}.md`), slug, 'zh');
}

console.log(`Done. ${slugs.length} slugs × 2 locales.`);
