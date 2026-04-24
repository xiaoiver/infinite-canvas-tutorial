/* eslint-env node */
const esm = [
  'd3-*',
  'earcut',
  'potpack',
  '@mapbox',
  '@antv/hierarchy',
  'roughjs',
  'fractional-indexing',
  'point-to-segment-2d',
  '@chenglou/pretext',
  'uuid',
]
  .map((d) => `_${d}|${d}`)
  .join('|');

module.exports = {
  testTimeout: 100000,
  setupFiles: ['<rootDir>/__tests__/jest-pretext-canvas.js'],
  testMatch: ['**/ecs/*.spec.+(ts|tsx|js)'],
  preset: 'ts-jest',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  modulePathIgnorePatterns: ['dist', '\\.next'],
  // Workspace package: resolve to source so tests run without a prior device-api build
  moduleNameMapper: {
    '^@infinite-canvas-tutorial/device-api$':
      '<rootDir>/packages/device-api/src/index.ts',
  },
  collectCoverageFrom: ['packages/ecs/src/**/*.ts'],
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
  transformIgnorePatterns: [
    `<rootDir>/node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?(${esm}))`,
  ],
};
