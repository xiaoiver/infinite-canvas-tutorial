const esm = [
  'd3-*',
  'earcut',
  'potpack',
  '@mapbox',
  'roughjs',
  '@chenglou/pretext',
  'uuid',
]
  .map((d) => `_${d}|${d}`)
  .join('|');

module.exports = {
  testTimeout: 100000,
  setupFiles: ['<rootDir>/__tests__/jest-pretext-canvas.js'],
  testMatch: [
    '<rootDir>/__tests__/**/*/*.spec.+(ts|tsx|js)',
    '!**/e2e/*.spec.+(ts|tsx|js)',
    '!**/ui/*.spec.+(ts|tsx|js)',
    '!**/ecs/*.spec.+(ts|tsx|js)',
    // '**/ssr/selector.spec.+(ts|tsx|js)',
  ],
  preset: 'ts-jest',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  modulePathIgnorePatterns: ['dist'],
  collectCoverageFrom: ['packages/core/src/**/*.ts'],
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        isolatedModules: true,
        tsconfig: {
          allowJs: true,
          target: 'esnext',
          esModuleInterop: true,
        },
      },
    ],
  },
  // pnpm nests deps at .pnpm/<name>@<ver>/node_modules/<name>/ — whitelist must include that prefix
  transformIgnorePatterns: [
    `<rootDir>/node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?(${esm}))`,
  ],
};
