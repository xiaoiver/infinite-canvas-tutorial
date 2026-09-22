/**
 * Migrate legacy fill / fillOpacity in packages/site Vue demos to fills[].
 * Only touches files that import @infinite-canvas-tutorial/ecs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function walkVue(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkVue(p, acc);
    else if (e.name.endsWith('.vue')) acc.push(p);
  }
  return acc;
}

/** Heuristic: serialized fill value expression → layer type */
function layerTypeForExpr(exprRaw) {
  const e = exprRaw.trim();
  let inner = e;
  if (
    (e.startsWith("'") && e.endsWith("'")) ||
    (e.startsWith('"') && e.endsWith('"'))
  ) {
    inner = e.slice(1, -1);
  } else if (e.startsWith('`') && e.endsWith('`')) {
    inner = e.slice(1, -1);
  }
  if (/linear-gradient|radial-gradient|conic-gradient/i.test(inner)) {
    return 'gradient';
  }
  if (
    /^https?:\/\//i.test(inner) ||
    inner.startsWith('data:') ||
    (inner.startsWith('/') && inner.length > 1)
  ) {
    return 'image';
  }
  return 'solid';
}

/** Web Animations API `KeyframeEffect` / `animate()` fill mode only (not SVG fill "none"). */
const ANIM_FILL_MODES = new Set(['both', 'forwards', 'backwards']);

function isAnimationFillMode(exprRaw) {
  const e = exprRaw.trim();
  const m = e.match(/^['"]([^'"]+)['"]$/);
  if (!m) return false;
  return ANIM_FILL_MODES.has(m[1]);
}

/** fill 右侧：引号串（可含逗号）或标识符 */
const FILL_VALUE_RE =
  /(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`|[A-Za-z_$][\w$.]*)/;

function replaceFillOpacityPairs(content) {
  const re = new RegExp(
    `([ \\t]*)fill:\\s*(${FILL_VALUE_RE.source})\\s*,\\s*\\r?\\n[ \\t]*fillOpacity:\\s*([^,\\n]+),`,
    'g',
  );
  return content.replace(re, (full, indent, fillExpr, opExpr) => {
    const ty = layerTypeForExpr(fillExpr);
    return `${indent}fills: [{ type: '${ty}', value: ${fillExpr.trim()}, opacity: ${opExpr.trim()} }],`;
  });
}

/**
 * 仅替换「值 + 逗号」形式，避免 `{ fill: 'x' }` 中吞掉 `}` 破坏 keyframes。
 * 含 `${` 的模板串跳过，需手写 fills。
 */
function replaceStandaloneFill(content) {
  const re = new RegExp(
    `([ \\t]*)fill:\\s*(${FILL_VALUE_RE.source})\\s*,`,
    'g',
  );
  return content.replace(re, (full, indent, fillExpr) => {
    const ex = fillExpr.trim();
    if (isAnimationFillMode(ex)) {
      return full;
    }
    if (ex.startsWith('`') && ex.includes('${')) {
      return full;
    }
    if (ex.startsWith('{') || ex.startsWith('...')) {
      return full;
    }
    const ty = layerTypeForExpr(fillExpr);
    return `${indent}fills: [{ type: '${ty}', value: ${ex}, opacity: 1 }],`;
  });
}

function processFile(absPath) {
  let s = fs.readFileSync(absPath, 'utf8');
  if (!s.includes('@infinite-canvas-tutorial/ecs')) {
    return false;
  }
  if (!/\bfillOpacity\b|\bfill:\s/.test(s)) {
    return false;
  }
  const before = s;
  s = replaceFillOpacityPairs(s);
  s = replaceStandaloneFill(s);
  if (s !== before) {
    fs.writeFileSync(absPath, s, 'utf8');
    return true;
  }
  return false;
}

const site = path.join(ROOT, 'packages/site');
let n = 0;
for (const f of walkVue(site)) {
  if (processFile(f)) {
    console.log('updated', path.relative(ROOT, f));
    n++;
  }
}
console.log('done,', n, 'files');
