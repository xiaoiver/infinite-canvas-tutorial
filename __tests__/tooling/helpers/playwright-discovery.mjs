import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export function discover(config, shard = '1/1', group = 'all') {
  const report = JSON.parse(
    execFileSync(
      process.execPath,
      [
        require.resolve('@playwright/test/cli'),
        'test',
        '-c',
        config,
        `--shard=${shard}`,
        '--list',
        '--reporter=json',
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          PLAYWRIGHT_WEBKIT_GROUP: group,
          PLAYWRIGHT_JSON_OUTPUT_FILE: '',
        },
        maxBuffer: 8 * 1024 * 1024,
      },
    ),
  );
  const ids = [];
  const visit = (suite) => {
    for (const spec of suite.specs ?? []) ids.push(spec.id);
    for (const child of suite.suites ?? []) visit(child);
  };
  for (const suite of report.suites) visit(suite);
  return ids;
}
