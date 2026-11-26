import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { compareWorkflowInputs } from './workflow-input-tools.mjs';
const [before, after, ...extra] = process.argv.slice(2);
assert(
  before && after && !extra.length,
  'Usage: node scripts/compare-workflow-input.mjs before.json after.json',
);
console.log(
  JSON.stringify(
    compareWorkflowInputs(
      JSON.parse(readFileSync(before, 'utf8')),
      JSON.parse(readFileSync(after, 'utf8')),
    ),
    null,
    2,
  ),
);
