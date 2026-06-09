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
  testTimeout: 30000,
  setupFiles: ['<rootDir>/__tests__/jest-pretext-canvas.js'],
  testMatch: ['**/ecs/*.spec.+(ts|tsx|js)'],
  preset: 'ts-jest',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  modulePathIgnorePatterns: ['dist', '\\.next'],
  // Workspace packages: resolve to source so tests run without a prior build
  moduleNameMapper: {
    '^@infinite-canvas-tutorial/device-api$':
      '<rootDir>/packages/device-api/src/index.ts',
    '^@infinite-canvas-tutorial/ecs$': '<rootDir>/packages/ecs/src/index.ts',
    '^@infinite-canvas-tutorial/ecs/(.*)$': '<rootDir>/packages/ecs/src/$1',
    '^heic2any$': '<rootDir>/__tests__/mocks/heic2any.ts',
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
