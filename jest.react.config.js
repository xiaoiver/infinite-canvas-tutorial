module.exports = {
  testEnvironment:
    '<rootDir>/packages/react/node_modules/jest-environment-jsdom',
  testMatch: ['<rootDir>/__tests__/react/*.spec.ts?(x)'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/react/setup.ts'],
  moduleNameMapper: {
    '^@infinite-canvas-tutorial/webcomponents/events$': '<rootDir>/packages/webcomponents/src/event.ts',
    '^react$': '<rootDir>/packages/react/node_modules/react',
    '^react/(.*)$': '<rootDir>/packages/react/node_modules/react/$1',
    '^react-dom$': '<rootDir>/packages/react/node_modules/react-dom',
    '^react-dom/(.*)$': '<rootDir>/packages/react/node_modules/react-dom/$1',
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
