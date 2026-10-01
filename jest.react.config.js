const reactModules =
  process.env.REACT_TEST_MODULES || '<rootDir>/packages/react/node_modules';

module.exports = {
  testEnvironment:
    '<rootDir>/packages/react/node_modules/jest-environment-jsdom',
  testMatch: ['<rootDir>/__tests__/react/*.spec.ts?(x)'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/react/setup.ts'],
  moduleNameMapper: {
    '^@infinite-canvas-tutorial/webcomponents/events$':
      '<rootDir>/packages/webcomponents/src/event.ts',
    '^react$': `${reactModules}/react`,
    '^react/(.*)$': `${reactModules}/react/$1`,
    '^react-dom$': `${reactModules}/react-dom`,
    '^react-dom/(.*)$': `${reactModules}/react-dom/$1`,
  },
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        isolatedModules: true,
        tsconfig: { target: 'esnext', jsx: 'react-jsx', esModuleInterop: true },
      },
    ],
  },
};
