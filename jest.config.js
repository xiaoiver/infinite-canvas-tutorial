const esm = ['d3-*', 'earcut', 'potpack', '@mapbox', 'roughjs']
  .map((d) => `_${d}|${d}`)
  .join('|');

module.exports = {
  testTimeout: 100000,
  testMatch: [
    '<rootDir>/__tests__/**/*/*.spec.+(ts|tsx|js)',
    '!**/e2e/*.spec.+(ts|tsx|js)',
    '!**/ui/*.spec.+(ts|tsx|js)',
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
  transformIgnorePatterns: [`<rootDir>/node_modules/(?!(?:.pnpm/)?(${esm}))`],
};
