import { readFileSync } from 'node:fs';
import { summarizeWorkflowContinuous } from './workflow-continuous-tools.mjs';
if (!process.argv[2])
  throw new Error(
    'Usage: node scripts/summarize-workflow-continuous.mjs CAPTURE.json',
  );
console.log(
  JSON.stringify(
    summarizeWorkflowContinuous(
      JSON.parse(readFileSync(process.argv[2], 'utf8')),
    ),
    null,
    2,
  ),
);
