import { readFileSync } from 'node:fs';
import { compareWorkflowCompositions } from './workflow-input-tools.mjs';
const [control, candidate] = process.argv.slice(2);
if (!control || !candidate)
  throw new Error(
    'Usage: node scripts/compare-workflow-composition.mjs normal.json condition.json',
  );
console.log(
  JSON.stringify(
    compareWorkflowCompositions(
      JSON.parse(readFileSync(control, 'utf8')),
      JSON.parse(readFileSync(candidate, 'utf8')),
    ),
    null,
    2,
  ),
);
