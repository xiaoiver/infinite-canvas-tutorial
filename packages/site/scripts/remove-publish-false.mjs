/**
 * Strip `publish: false` from the first YAML frontmatter block only (file start).
 * Run: node packages/site/scripts/remove-publish-false.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const docsRoot = join(import.meta.dirname, '../docs');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}

function stripPublishFalse(content) {
  if (!content.startsWith('---')) return content;
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
  if (!m) return content;
  const rawFm = m[1];
  const afterClose = content.slice(m[0].length);
  const lines = rawFm.split(/\r?\n/);
  const kept = lines.filter((line) => !/^publish:\s*false\s*$/.test(line));
  const newFm = kept.join('\n').trim();
  if (newFm === '') return afterClose.replace(/^\r?\n/, '');
  return `---\n${newFm}\n---${afterClose.startsWith('\n') ? '' : '\n'}${afterClose}`;
}

let n = 0;
for (const file of walk(docsRoot)) {
  const before = readFileSync(file, 'utf8');
  const after = stripPublishFalse(before);
  if (after !== before) {
    writeFileSync(file, after, 'utf8');
    n++;
  }
}
console.log(`Updated ${n} files.`);
