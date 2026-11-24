import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { compareReplays } from './camera-replay-tools.mjs';
const [before, after, ...flags] = process.argv.slice(2);
assert(
  before && after && flags.every((f) => f === '--require-native-parity'),
  'Usage: node scripts/compare-camera-replay.mjs before.json after.json [--require-native-parity]',
);
console.log(
  JSON.stringify(
    compareReplays(
      JSON.parse(readFileSync(before, 'utf8')),
      JSON.parse(readFileSync(after, 'utf8')),
      { requireNativeParity: flags.includes('--require-native-parity') },
    ),
    null,
    2,
  ),
);
