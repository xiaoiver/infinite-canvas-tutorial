const path = require('node:path');
const { realpathSync } = require('node:fs');
const canonical = (file) => realpathSync(path.resolve(file));
const { execFileSync } = require('node:child_process');

function mergeChanges() {
  try {
    execFileSync('git', ['rev-parse', '--verify', 'MERGE_HEAD'], {
      stdio: 'ignore',
    });
  } catch {
    return null;
  }
  // Check our final resolution against the incoming tree, not every inherited file.
  return new Set(
    execFileSync(
      'git',
      [
        'diff',
        '--cached',
        '--name-only',
        '--diff-filter=ACMR',
        '-z',
        'MERGE_HEAD',
      ],
      { encoding: 'utf8' },
    )
      .split('\0')
      .filter(Boolean)
      .map(canonical),
  );
}
const changes = mergeChanges();
function tasks(commands) {
  return (files) => {
    const selected = files.filter(
      (file) => !changes || changes.has(canonical(file)),
    );
    return selected.length
      ? commands.map(
          (command) =>
            `${command} ${selected
              .map((file) => JSON.stringify(file))
              .join(' ')}`,
        )
      : [];
  };
}
module.exports = {
  '*.json': tasks(['prettier --write']),
  '*.md': tasks(['case-police --fix', 'prettier --write', 'markdownlint']),
  '*.{js,mjs,cjs,jsx,tsx,ts,vue}': tasks(['eslint --fix']),
};
