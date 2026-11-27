import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import {
  compareStrokeTextures,
  summarizeStrokeTextures,
} from './stroke-texture-comparison.mjs';
const root = process.argv[2];
if (!root)
  throw new Error(
    'Usage: node scripts/compare-stroke-textures.mjs CAPTURE_ROOT',
  );
const captures = [],
  audits = [];
for (const workload of ['workflow', 'strokes']) {
  const cs = ['packed-1', 'texture-1', 'texture-2', 'packed-2'].map((label) => {
    const path = join(
      root,
      workload,
      label,
      workload === 'workflow'
        ? 'workflow-input.json'
        : 'camera-replay-strokes.json',
    );
    const raw = readFileSync(path),
      c = JSON.parse(raw);
    captures.push({
      workload,
      label,
      raw: {
        path,
        bytes: raw.length,
        sha256: createHash('sha256').update(raw).digest('hex'),
      },
      source: c.source,
      strokeTexture: c.strokeTexture,
      rows: summarizeStrokeTextures(c),
    });
    return c;
  });
  audits.push({
    workload,
    comparisons: cs.map((c) => compareStrokeTextures(cs[0], c)),
    packedRepeat: compareStrokeTextures(cs[0], cs[3], { repeat: true }),
    textureRepeat: compareStrokeTextures(cs[1], cs[2], { repeat: true }),
  });
}
console.log(JSON.stringify({ audits, captures }, null, 2));
